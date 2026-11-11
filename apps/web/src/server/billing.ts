import { EducatorNotFoundError, type BillingSummary, type SubscriptionUpdate } from "@evolyfoot/database";
import {
  billingCycles,
  billingItemOfLookupKey,
  billingLines,
  billingPriceLookupKey,
  billingTotal,
  parseBillingCycle,
  type BillingCycle,
  type BillingLine,
} from "@evolyfoot/domain";
import type { PublicAccount } from "./auth";

export interface BillingStore {
  summary(accountId: string): Promise<BillingSummary>;
  setCustomer(coachId: string, stripeCustomerId: string): Promise<void>;
  applySubscription(stripeCustomerId: string, update: SubscriptionUpdate): Promise<boolean>;
}

export interface WebhookSubscriptionEvent {
  customerId: string;
  update: SubscriptionUpdate;
}

// Ce dont l'appli a besoin chez Stripe (voir createStripeGateway) : remplaçable dans les tests.
export interface PaymentGateway {
  createCustomer(input: { email: string; name: string; coachId: string }): Promise<string>;
  createCheckout(input: {
    customerId: string;
    coachId: string;
    cycle: BillingCycle;
    lines: BillingLine[];
    trialEnd: Date | null;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string>;
  createPortal(input: { customerId: string; returnUrl: string }): Promise<string>;
  // Aligne les quantités de l'abonnement sur les équipes et coachs du moment (au prorata).
  syncQuantities(input: { subscriptionId: string; cycle: BillingCycle; lines: BillingLine[] }): Promise<void>;
  // Vérifie la signature et ne garde que les événements d'abonnement ; null pour les autres.
  readWebhook(payload: string, signature: string): Promise<WebhookSubscriptionEvent | null>;
}

export interface BillingView {
  // false tant que les clés Stripe ne sont pas configurées sur le serveur.
  enabled: boolean;
  // true quand l'accès à l'appli est bloqué à la fin de l'essai (BILLING_ENFORCED).
  enforced: boolean;
  // Seul le coach titulaire gère l'abonnement ; un adjoint ne voit que l'état.
  canManage: boolean;
  access: { state: "subscribed"; status: string } | { state: "trial"; trialEndsAt: string; daysLeft: number } | { state: "expired"; trialEndsAt: string };
  cycle: BillingCycle | null;
  currentPeriodEnd: string | null;
  extraTeams: number;
  extraCoaches: number;
  quotes: Record<BillingCycle, { lines: BillingLine[]; total: number }>;
}

type Resolve = (request: Request) => Promise<PublicAccount | null>;
type Log = (error: unknown) => void;

const notEnabled = () => Response.json({ error: "Le paiement en ligne n’est pas encore activé." }, { status: 503 });
const unauthorized = () => Response.json({ error: "Authentification requise." }, { status: 401 });

export function billingEnforced(): boolean {
  return process.env.BILLING_ENFORCED === "true";
}

export function toBillingView(summary: BillingSummary, account: PublicAccount, enabled: boolean): BillingView {
  const quotes = Object.fromEntries(
    billingCycles.map((cycle) => {
      const lines = billingLines(cycle, summary.extraTeams, summary.extraCoaches);
      return [cycle, { lines, total: billingTotal(lines) }];
    }),
  ) as BillingView["quotes"];
  const { access } = summary;
  return {
    enabled,
    enforced: billingEnforced(),
    canManage: account.id === summary.coachId,
    access:
      access.state === "subscribed"
        ? access
        : access.state === "trial"
          ? { state: "trial", trialEndsAt: access.trialEndsAt.toISOString(), daysLeft: access.daysLeft }
          : { state: "expired", trialEndsAt: access.trialEndsAt.toISOString() },
    cycle: summary.billingCycle,
    currentPeriodEnd: summary.currentPeriodEnd?.toISOString() ?? null,
    extraTeams: summary.extraTeams,
    extraCoaches: summary.extraCoaches,
    quotes,
  };
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function withSummary(
  request: Request,
  resolveAccount: Resolve,
  store: Pick<BillingStore, "summary">,
  log: Log,
  run: (account: PublicAccount, summary: BillingSummary) => Promise<Response>,
): Promise<Response> {
  const account = await resolveAccount(request);
  if (!account || account.role === "player") {
    return unauthorized();
  }
  try {
    return await run(account, await store.summary(account.id));
  } catch (error) {
    if (error instanceof EducatorNotFoundError) {
      return unauthorized();
    }
    log(error);
    return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}

export function createGetBillingHandler(resolveAccount: Resolve, store: Pick<BillingStore, "summary">, enabled: boolean, log: Log) {
  return (request: Request) =>
    withSummary(request, resolveAccount, store, log, async (account, summary) => Response.json({ billing: toBillingView(summary, account, enabled) }));
}

// POST { cycle } : page de paiement Stripe. Pendant l'essai, le premier prélèvement attend la fin de l'essai.
export function createCheckoutHandler(
  resolveAccount: Resolve,
  store: BillingStore,
  payments: PaymentGateway | null,
  origin: (request: Request) => string,
  log: Log,
) {
  return async (request: Request) => {
    if (!payments) return notEnabled();
    const cycle = parseBillingCycle((await readJsonBody(request))?.cycle);
    return withSummary(request, resolveAccount, store, log, async (account, summary) => {
      if (account.id !== summary.coachId) {
        return Response.json({ error: "Seul le coach titulaire gère l’abonnement." }, { status: 403 });
      }
      if (!cycle) {
        return Response.json({ error: "Choisis un rythme de paiement." }, { status: 400 });
      }
      if (summary.access.state === "subscribed") {
        return Response.json({ error: "Tu es déjà abonné : gère ton abonnement depuis le portail." }, { status: 409 });
      }
      let customerId = summary.stripeCustomerId;
      if (!customerId) {
        customerId = await payments.createCustomer({ email: summary.email, name: summary.displayName, coachId: summary.coachId });
        await store.setCustomer(summary.coachId, customerId);
      }
      // Stripe exige une fin d'essai à plus de 48 h : en deçà, le paiement démarre tout de suite.
      const trialEnd =
        summary.access.state === "trial" && summary.access.trialEndsAt.getTime() - Date.now() > 49 * 60 * 60 * 1000 ? summary.access.trialEndsAt : null;
      const base = origin(request);
      const url = await payments.createCheckout({
        customerId,
        coachId: summary.coachId,
        cycle,
        lines: billingLines(cycle, summary.extraTeams, summary.extraCoaches),
        trialEnd,
        successUrl: `${base}/abonnement?paiement=ok`,
        cancelUrl: `${base}/abonnement`,
      });
      return Response.json({ url });
    });
  };
}

// POST : portail Stripe (moyen de paiement, factures, changement de rythme, résiliation).
export function createPortalHandler(
  resolveAccount: Resolve,
  store: Pick<BillingStore, "summary">,
  payments: PaymentGateway | null,
  origin: (request: Request) => string,
  log: Log,
) {
  return async (request: Request) => {
    if (!payments) return notEnabled();
    return withSummary(request, resolveAccount, store, log, async (account, summary) => {
      if (account.id !== summary.coachId || !summary.stripeCustomerId) {
        return Response.json({ error: "Aucun abonnement à gérer." }, { status: 403 });
      }
      return Response.json({ url: await payments.createPortal({ customerId: summary.stripeCustomerId, returnUrl: `${origin(request)}/abonnement` }) });
    });
  };
}

// POST : après l'ajout ou le retrait d'une équipe ou d'un adjoint, met l'abonnement à jour.
export function createSyncHandler(resolveAccount: Resolve, store: Pick<BillingStore, "summary">, payments: PaymentGateway | null, log: Log) {
  return async (request: Request) => {
    if (!payments) return notEnabled();
    return withSummary(request, resolveAccount, store, log, async (account, summary) => {
      if (account.id !== summary.coachId || !summary.stripeSubscriptionId || !summary.billingCycle || summary.access.state !== "subscribed") {
        return Response.json({ error: "Aucun abonnement à mettre à jour." }, { status: 409 });
      }
      await payments.syncQuantities({
        subscriptionId: summary.stripeSubscriptionId,
        cycle: summary.billingCycle,
        lines: billingLines(summary.billingCycle, summary.extraTeams, summary.extraCoaches),
      });
      return Response.json({ ok: true });
    });
  };
}

// Webhook Stripe : la seule source de vérité de l'état de l'abonnement.
export function createWebhookHandler(store: Pick<BillingStore, "applySubscription">, payments: PaymentGateway | null, log: Log) {
  return async (request: Request) => {
    if (!payments) return notEnabled();
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return Response.json({ error: "Signature manquante." }, { status: 400 });
    }
    let event: WebhookSubscriptionEvent | null;
    try {
      event = await payments.readWebhook(await request.text(), signature);
    } catch (error) {
      log(error);
      return Response.json({ error: "Signature invalide." }, { status: 400 });
    }
    if (event) {
      try {
        await store.applySubscription(event.customerId, event.update);
      } catch (error) {
        log(error);
        return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
      }
    }
    return Response.json({ received: true });
  };
}

const subscriptionEvents = new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);

// Passerelle Stripe réelle, ou null tant que STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET ne sont pas définis.
export async function createStripeGateway(): Promise<PaymentGateway | null> {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secretKey || !webhookSecret) {
    return null;
  }
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secretKey);
  const { billingItemLabels, billingPrices } = await import("@evolyfoot/domain");

  // Les prix sont créés au premier besoin et retrouvés ensuite par leur clé : rien à saisir dans Stripe.
  async function priceId(item: BillingLine["item"], cycle: BillingCycle): Promise<string> {
    const lookupKey = billingPriceLookupKey(item, cycle);
    const found = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    if (found.data[0]) return found.data[0].id;
    const price = await stripe.prices.create({
      currency: "eur",
      unit_amount: Math.round(billingPrices[item][cycle] * 100),
      recurring: { interval: cycle === "monthly" ? "month" : "year" },
      lookup_key: lookupKey,
      product_data: { name: billingItemLabels[item] },
    });
    return price.id;
  }

  async function lineItems(cycle: BillingCycle, lines: BillingLine[]) {
    return Promise.all(lines.map(async (line) => ({ price: await priceId(line.item, cycle), quantity: line.quantity })));
  }

  return {
    async createCustomer({ email, name, coachId }) {
      const customer = await stripe.customers.create({ email, name, metadata: { coachId } });
      return customer.id;
    },
    async createCheckout({ customerId, coachId, cycle, lines, trialEnd, successUrl, cancelUrl }) {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: coachId,
        line_items: await lineItems(cycle, lines),
        allow_promotion_codes: true,
        locale: "fr",
        subscription_data: {
          metadata: { coachId, cycle },
          ...(trialEnd ? { trial_end: Math.floor(trialEnd.getTime() / 1000) } : {}),
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      if (!session.url) throw new Error("Stripe n’a pas renvoyé de page de paiement.");
      return session.url;
    },
    async createPortal({ customerId, returnUrl }) {
      const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl, locale: "fr" });
      return session.url;
    },
    async syncQuantities({ subscriptionId, cycle, lines }) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const wanted = new Map(lines.map((line) => [line.item, line.quantity]));
      const items: { id?: string; price?: string; quantity?: number; deleted?: boolean }[] = [];
      for (const existing of subscription.items.data) {
        const known = billingItemOfLookupKey(existing.price.lookup_key);
        if (!known) continue;
        const quantity = wanted.get(known.item);
        items.push(quantity ? { id: existing.id, quantity } : { id: existing.id, deleted: true });
        wanted.delete(known.item);
      }
      for (const [item, quantity] of wanted) {
        items.push({ price: await priceId(item, cycle), quantity });
      }
      await stripe.subscriptions.update(subscriptionId, { items, proration_behavior: "create_prorations" });
    },
    async readWebhook(payload, signature) {
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      if (!subscriptionEvents.has(event.type)) return null;
      const subscription = event.data.object as import("stripe").Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const first = subscription.items.data[0];
      const periodEnd = first?.current_period_end;
      return {
        customerId,
        update: {
          subscriptionId: subscription.id,
          status: subscription.status,
          cycle: billingItemOfLookupKey(first?.price.lookup_key)?.cycle ?? parseBillingCycle(subscription.metadata?.cycle),
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        },
      };
    },
  };
}

export async function createBillingStore(): Promise<{ store: BillingStore; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, BillingService } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new BillingService(database.prisma);
  return {
    store: {
      summary: (accountId) => service.summary(accountId),
      setCustomer: (coachId, customerId) => service.setCustomer(coachId, customerId),
      applySubscription: (customerId, update) => service.applySubscription(customerId, update),
    },
    disconnect: () => database.disconnect(),
  };
}
