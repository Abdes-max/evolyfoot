import { describe, expect, it } from "vitest";
import { billingAccess, billingItemOfLookupKey, billingLines, billingPriceLookupKey, billingTotal, parseBillingCycle, trialEndOf } from "./billing";

describe("abonnement", () => {
  it("facture la base seule pour 1 coach et 1 équipe", () => {
    const lines = billingLines("monthly", 0, 0);
    expect(lines).toEqual([{ item: "base", quantity: 1, unitPrice: 7.9 }]);
    expect(billingTotal(lines)).toBe(7.9);
  });

  it("ajoute les équipes et coachs en plus, au tarif réduit", () => {
    const lines = billingLines("season", 2, 1);
    expect(lines.map((line) => [line.item, line.quantity])).toEqual([
      ["base", 1],
      ["team", 2],
      ["coach", 1],
    ]);
    expect(billingTotal(lines)).toBe(59 + 2 * 29 + 24);
    expect(billingTotal(billingLines("monthly", 1, 2))).toBe(17.6);
  });

  it("retrouve l'article et le rythme depuis la clé du prix", () => {
    expect(billingItemOfLookupKey(billingPriceLookupKey("team", "season"))).toEqual({ item: "team", cycle: "season" });
    expect(billingItemOfLookupKey("autre")).toBeNull();
    expect(parseBillingCycle("season")).toBe("season");
    expect(parseBillingCycle("annual")).toBeNull();
  });

  it("donne 14 jours d'essai après l'inscription, sauf date déjà fixée", () => {
    const createdAt = new Date("2026-11-01T10:00:00Z");
    expect(trialEndOf(createdAt, null).toISOString()).toBe("2026-11-15T10:00:00.000Z");
    const fixed = new Date("2026-12-01T00:00:00Z");
    expect(trialEndOf(createdAt, fixed)).toBe(fixed);
  });

  it("calcule l'accès : abonné, en essai ou essai terminé", () => {
    const createdAt = new Date("2026-11-01T10:00:00Z");
    expect(billingAccess({ createdAt, trialEndsAt: null, subscriptionStatus: "active", now: new Date("2027-01-01") })).toEqual({
      state: "subscribed",
      status: "active",
    });
    expect(billingAccess({ createdAt, trialEndsAt: null, subscriptionStatus: null, now: new Date("2026-11-10T10:00:00Z") })).toMatchObject({
      state: "trial",
      daysLeft: 5,
    });
    expect(billingAccess({ createdAt, trialEndsAt: null, subscriptionStatus: "canceled", now: new Date("2026-11-20") }).state).toBe("expired");
    expect(billingAccess({ createdAt, trialEndsAt: null, subscriptionStatus: "past_due", now: new Date("2027-01-01") }).state).toBe("subscribed");
  });
});
