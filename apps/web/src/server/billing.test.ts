import type { BillingSummary } from "@evolyfoot/database";
import { describe, expect, it, vi } from "vitest";
import type { PublicAccount } from "./auth";
import { createCheckoutHandler, createGetBillingHandler, createPortalHandler, createSyncHandler, createWebhookHandler, type PaymentGateway } from "./billing";

const coach: PublicAccount = { id: "coach-1", email: "c@example.test", displayName: "Karim", role: "coach", linkedPlayerId: null, emailVerified: true };
const assistant: PublicAccount = { ...coach, id: "adjoint-1", role: "assistant" };

function summary(overrides: Partial<BillingSummary> = {}): BillingSummary {
  return {
    coachId: "coach-1",
    email: "c@example.test",
    displayName: "Karim",
    access: { state: "trial", trialEndsAt: new Date(Date.now() + 10 * 24 * 3600 * 1000), daysLeft: 10 },
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: null,
    billingCycle: null,
    currentPeriodEnd: null,
    cancelAt: null,
    billedExtraTeams: null,
    billedExtraCoaches: null,
    lastReminder: null,
    extraTeams: 1,
    extraCoaches: 2,
    ...overrides,
  };
}

function payments(): PaymentGateway {
  return {
    createCustomer: vi.fn(async () => "cus_1"),
    customerExists: vi.fn(async (customerId: string) => customerId !== "cus_test_mode"),
    createCheckout: vi.fn(async () => "https://checkout.stripe.test/s"),
    createPortal: vi.fn(async () => "https://billing.stripe.test/p"),
    syncQuantities: vi.fn(async () => undefined),
    readWebhook: vi.fn(async () => ({
      customerId: "cus_1",
      update: { subscriptionId: "sub_1", status: "active", cycle: "monthly" as const, currentPeriodEnd: null },
    })),
  };
}

const post = (body: unknown) => new Request("http://localhost/api/billing/checkout", { method: "POST", body: JSON.stringify(body) });

describe("abonnement : API", () => {
  it("renvoie l'état et les devis des deux rythmes", async () => {
    const response = await createGetBillingHandler(
      async () => coach,
      { summary: async () => summary() },
      true,
      () => undefined,
    )(new Request("http://localhost/api/billing"));
    const { billing } = await response.json();
    expect(billing.access).toMatchObject({ state: "trial", daysLeft: 10 });
    expect(billing.canManage).toBe(true);
    expect(billing.quotes.monthly.total).toBe(7.9 + 3.9 + 2 * 2.9);
    expect(billing.quotes.season.total).toBe(59 + 29 + 2 * 24);
  });

  it("crée le client Stripe puis la page de paiement, en gardant les jours d'essai", async () => {
    const gateway = payments();
    const store = { summary: async () => summary(), setCustomer: vi.fn(async () => undefined), applySubscription: vi.fn(async () => true) };
    const response = await createCheckoutHandler(
      async () => coach,
      store,
      gateway,
      () => "https://evolyfoot.test",
      () => undefined,
    )(post({ cycle: "season" }));
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.test/s" });
    expect(store.setCustomer).toHaveBeenCalledWith("coach-1", "cus_1");
    const checkout = vi.mocked(gateway.createCheckout).mock.calls[0][0];
    expect(checkout.cycle).toBe("season");
    expect(checkout.lines.map((line) => line.item)).toEqual(["base", "team", "coach"]);
    expect(checkout.trialEnd).not.toBeNull();
    expect(checkout.successUrl).toBe("https://evolyfoot.test/abonnement?paiement=ok");
  });

  it("recrée le client Stripe enregistré s'il est inconnu (passage des clés de test aux clés live)", async () => {
    const gateway = payments();
    const store = {
      summary: async () => summary({ stripeCustomerId: "cus_test_mode" }),
      setCustomer: vi.fn(async () => undefined),
      applySubscription: vi.fn(async () => true),
    };
    await createCheckoutHandler(
      async () => coach,
      store,
      gateway,
      () => "https://evolyfoot.test",
      () => undefined,
    )(post({ cycle: "monthly" }));
    expect(store.setCustomer).toHaveBeenCalledWith("coach-1", "cus_1");
    expect(vi.mocked(gateway.createCheckout).mock.calls[0][0].customerId).toBe("cus_1");
  });

  it("refuse le paiement à un adjoint, sans rythme, ou sans Stripe configuré", async () => {
    const store = { summary: async () => summary(), setCustomer: vi.fn(), applySubscription: vi.fn() };
    expect(
      (
        await createCheckoutHandler(
          async () => assistant,
          store,
          payments(),
          () => "",
          () => undefined,
        )(post({ cycle: "monthly" }))
      ).status,
    ).toBe(403);
    expect(
      (
        await createCheckoutHandler(
          async () => coach,
          store,
          payments(),
          () => "",
          () => undefined,
        )(post({}))
      ).status,
    ).toBe(400);
    expect(
      (
        await createCheckoutHandler(
          async () => coach,
          store,
          null,
          () => "",
          () => undefined,
        )(post({ cycle: "monthly" }))
      ).status,
    ).toBe(503);
  });

  it("ouvre directement la résiliation avec le bouton Résilier, sauf si elle est déjà programmée", async () => {
    const subscribed = { access: { state: "subscribed" as const, status: "active" }, stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" };
    const portal = (overrides: Partial<BillingSummary>) => {
      const gateway = payments();
      const handler = createPortalHandler(
        async () => coach,
        { summary: async () => summary({ ...subscribed, ...overrides }) },
        gateway,
        () => "https://evolyfoot.test",
        () => undefined,
      );
      return { gateway, handler };
    };
    const cancel = () => new Request("http://localhost", { method: "POST", body: JSON.stringify({ action: "cancel" }) });

    const first = portal({});
    expect(await (await first.handler(cancel())).json()).toEqual({ url: "https://billing.stripe.test/p" });
    expect(vi.mocked(first.gateway.createPortal).mock.calls[0][0]).toMatchObject({ customerId: "cus_1", cancelSubscriptionId: "sub_1" });

    const already = portal({ cancelAt: new Date("2027-01-01") });
    await already.handler(cancel());
    expect(vi.mocked(already.gateway.createPortal).mock.calls[0][0].cancelSubscriptionId).toBeUndefined();
  });

  it("met à jour les quantités d'un abonnement actif", async () => {
    const gateway = payments();
    const store = {
      summary: async () => summary({ access: { state: "subscribed", status: "active" }, stripeSubscriptionId: "sub_1", billingCycle: "monthly" }),
    };
    const response = await createSyncHandler(
      async () => coach,
      store,
      gateway,
      () => undefined,
    )(new Request("http://localhost", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(vi.mocked(gateway.syncQuantities).mock.calls[0][0].lines).toHaveLength(3);
  });

  it("enregistre l'abonnement reçu par le webhook, et rejette une signature absente", async () => {
    const store = { applySubscription: vi.fn(async () => true) };
    const handler = createWebhookHandler(store, payments(), () => undefined);
    expect((await handler(new Request("http://localhost", { method: "POST", body: "{}" }))).status).toBe(400);
    const response = await handler(new Request("http://localhost", { method: "POST", body: "{}", headers: { "stripe-signature": "t=1,v1=x" } }));
    expect(response.status).toBe(200);
    expect(store.applySubscription).toHaveBeenCalledWith("cus_1", expect.objectContaining({ status: "active" }));
  });
});
