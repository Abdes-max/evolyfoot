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
import { databaseErrorResponse } from "./api-errors";

export interface BillingStore {
  summary(accountId: string): Promise<BillingSummary>;
  setCustomer(coachId: string, stripeCustomerId: string): Promise<void>;
  applySubscription(stripeCustomerId: string, update: SubscriptionUpdate): Promise<boolean>;
  coachIdOfCustomer(stripeCustomerId: string): Promise<string | null>;
}

// E-mail envoyé au coach quand son abonnement change : Stripe n'envoie ni reçu pour un essai à 0 €, ni
// confirmation de résiliation.
export type SubscriptionNotice = "started" | "cancel-scheduled" | "resumed" | "ended";
export type Notify = (summary: BillingSummary, notice: SubscriptionNotice) => Promise<void>;

const liveStatuses = new Set(["trialing", "active", "past_due"]);

// Changement à annoncer entre l'état enregistré et l'état reçu de Stripe ; null s'il n'y a rien de neuf
// (un webhook rejoué ou déjà appliqué par la revérification ne renvoie pas d'e-mail).
export function subscriptionNotice(before: BillingSummary, update: SubscriptionUpdate): SubscriptionNotice | null {
  const wasLive = liveStatuses.has(before.subscriptionStatus ?? "");
  if (!liveStatuses.has(update.status)) {
    return wasLive && before.stripeSubscriptionId === update.subscriptionId && update.status === "canceled" ? "ended" : null;
  }
  if (before.stripeSubscriptionId !== update.subscriptionId || !wasLive) return "started";
  const cancelAt = update.cancelAt ?? null;
  if (cancelAt && !before.cancelAt) return "cancel-scheduled";
  if (!cancelAt && before.cancelAt) return "resumed";
  return null;
}

// Enregistre l'état reçu de Stripe et prévient le coach du changement.
async function applyAndNotify(
  store: Pick<BillingStore, "summary" | "applySubscription" | "coachIdOfCustomer">,
  customerId: string,
  update: SubscriptionUpdate,
  notify: Notify,
  log: Log,
): Promise<void> {
  const coachId = await store.coachIdOfCustomer(customerId);
  if (!coachId) return;
  const before = await store.summary(coachId);
  await store.applySubscription(customerId, update);
  const notice = subscriptionNotice(before, update);
  if (notice) {
    await notify(await store.summary(coachId), notice).catch(log);
  }
}

export interface WebhookSubscriptionEvent {
  customerId: string;
  update: SubscriptionUpdate;
}

// Ce dont l'appli a besoin chez Stripe (voir createStripeGateway) : remplaçable dans les tests.
export interface PaymentGateway {
  createCustomer(input: { email: string; name: string; coachId: string }): Promise<string>;
  // false si le client n'existe pas (ou plus) dans le mode Stripe des clés en place : un client créé
  // avec les clés de test est inconnu une fois les clés live installées.
  customerExists(customerId: string): Promise<boolean>;
  createCheckout(input: {
    customerId: string;
    coachId: string;
    cycle: BillingCycle;
    lines: BillingLine[];
    trialEnd: Date | null;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string>;
  // Avec subscriptionId, ouvre directement la résiliation de cet abonnement (bouton « Résilier »).
  createPortal(input: { customerId: string; returnUrl: string; cancelSubscriptionId?: string }): Promise<string>;
  // Aligne les quantités de l'abonnement sur les équipes et coachs du moment (au prorata).
  syncQuantities(input: { subscriptionId: string; cycle: BillingCycle; lines: BillingLine[] }): Promise<void>;
  // État actuel de l'abonnement chez Stripe ; null s'il n'existe pas (ou plus) dans le mode des clés en place.
  subscriptionState(subscriptionId: string): Promise<SubscriptionUpdate | null>;
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
  // A déjà eu un abonnement Stripe (résilié depuis) : un accès "expired" veut alors dire
  // "abonnement terminé", pas "essai terminé".
  everSubscribed: boolean;
  access: { state: "subscribed"; status: string } | { state: "trial"; trialEndsAt: string; daysLeft: number } | { state: "expired"; trialEndsAt: string };
  cycle: BillingCycle | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
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
    everSubscribed: summary.stripeSubscriptionId !== null,
    access:
      access.state === "subscribed"
        ? access
        : access.state === "trial"
          ? { state: "trial", trialEndsAt: access.trialEndsAt.toISOString(), daysLeft: access.daysLeft }
          : { state: "expired", trialEndsAt: access.trialEndsAt.toISOString() },
    cycle: summary.billingCycle,
    currentPeriodEnd: summary.currentPeriodEnd?.toISOString() ?? null,
    cancelAt: summary.cancelAt?.toISOString() ?? null,
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
    const databaseResponse = databaseErrorResponse(error, log);
    if (databaseResponse) {
      return databaseResponse;
    }
    log(error);
    return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}

// GET : état de l'abonnement. Pour un abonné, l'état est revérifié chez Stripe : un webhook manqué, ou un
// abonnement de test resté en base après le passage aux clés live, ne laisse pas un état faux affiché.
export function createGetBillingHandler(
  resolveAccount: Resolve,
  store: Pick<BillingStore, "summary" | "applySubscription" | "coachIdOfCustomer">,
  payments: PaymentGateway | null,
  log: Log,
  notify: Notify = async () => undefined,
) {
  return (request: Request) =>
    withSummary(request, resolveAccount, store, log, async (account, summary) => {
      let current = summary;
      if (payments && summary.access.state === "subscribed" && summary.stripeSubscriptionId && summary.stripeCustomerId) {
        const fresh = await payments.subscriptionState(summary.stripeSubscriptionId).catch((error: unknown) => {
          log(error);
          return undefined;
        });
        if (fresh && (fresh.status !== summary.subscriptionStatus || (fresh.cancelAt ?? null)?.getTime() !== summary.cancelAt?.getTime())) {
          await applyAndNotify(store, summary.stripeCustomerId, fresh, notify, log);
          current = await store.summary(account.id);
        } else if (fresh === null) {
          // Abonnement inconnu de Stripe (resté des clés de test) : pas d'e-mail, il n'a jamais été payé.
          await store.applySubscription(summary.stripeCustomerId, {
            subscriptionId: summary.stripeSubscriptionId,
            status: "canceled",
            cycle: null,
            currentPeriodEnd: null,
          });
          current = await store.summary(account.id);
        }
      }
      return Response.json({ billing: toBillingView(current, account, payments !== null) });
    });
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
      if (!customerId || !(await payments.customerExists(customerId))) {
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

// POST : portail Stripe (moyen de paiement, factures, résiliation). { action: "cancel" } ouvre directement la
// résiliation, pour le bouton « Résilier mon abonnement » exigé par la loi (résiliation en trois clics).
export function createPortalHandler(
  resolveAccount: Resolve,
  store: Pick<BillingStore, "summary">,
  payments: PaymentGateway | null,
  origin: (request: Request) => string,
  log: Log,
) {
  return async (request: Request) => {
    if (!payments) return notEnabled();
    const cancel = (await readJsonBody(request))?.action === "cancel";
    return withSummary(request, resolveAccount, store, log, async (account, summary) => {
      if (account.id !== summary.coachId || !summary.stripeCustomerId || !(await payments.customerExists(summary.stripeCustomerId))) {
        return Response.json({ error: "Aucun abonnement à gérer." }, { status: 403 });
      }
      const cancelSubscriptionId =
        cancel && summary.access.state === "subscribed" && !summary.cancelAt ? (summary.stripeSubscriptionId ?? undefined) : undefined;
      return Response.json({
        url: await payments.createPortal({ customerId: summary.stripeCustomerId, returnUrl: `${origin(request)}/abonnement`, cancelSubscriptionId }),
      });
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
export function createWebhookHandler(
  store: Pick<BillingStore, "summary" | "applySubscription" | "coachIdOfCustomer">,
  payments: PaymentGateway | null,
  log: Log,
  notify: Notify = async () => undefined,
) {
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
        await applyAndNotify(store, event.customerId, event.update, notify, log);
      } catch (error) {
        const databaseResponse = databaseErrorResponse(error, log);
        if (databaseResponse) {
          return databaseResponse;
        }
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
    async customerExists(customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        return !customer.deleted;
      } catch (error) {
        if ((error as { code?: string }).code === "resource_missing") return false;
        throw error;
      }
    },
    async createCheckout({ customerId, coachId, cycle, lines, trialEnd, successUrl, cancelUrl }) {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: coachId,
        line_items: await lineItems(cycle, lines),
        allow_promotion_codes: true,
        locale: "fr",
        // Adresse de facturation et n° de TVA (clubs, associations) : repris sur les factures envoyées par Stripe.
        billing_address_collection: "required",
        tax_id_collection: { enabled: true },
        customer_update: { address: "auto", name: "auto" },
        custom_text: {
          submit: {
            message: "Facture envoyée par e-mail à chaque échéance. Résiliable à tout moment depuis la page Abonnement d’EvolyFoot.",
          },
        },
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
    async createPortal({ customerId, returnUrl, cancelSubscriptionId }) {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
        locale: "fr",
        ...(cancelSubscriptionId
          ? {
              flow_data: {
                type: "subscription_cancel" as const,
                subscription_cancel: { subscription: cancelSubscriptionId },
                after_completion: { type: "redirect" as const, redirect: { return_url: `${returnUrl}?resiliation=ok` } },
              },
            }
          : {}),
      });
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
    async subscriptionState(subscriptionId) {
      try {
        return toUpdate(await stripe.subscriptions.retrieve(subscriptionId)).update;
      } catch (error) {
        if ((error as { code?: string }).code === "resource_missing") return null;
        throw error;
      }
    },
    async readWebhook(payload, signature) {
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      if (!subscriptionEvents.has(event.type)) return null;
      return toUpdate(event.data.object as import("stripe").Stripe.Subscription);
    },
  };
}

function toUpdate(subscription: import("stripe").Stripe.Subscription): WebhookSubscriptionEvent {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const first = subscription.items.data[0];
  const periodEnd = first?.current_period_end;
  const quantityOf = (item: "team" | "coach") =>
    subscription.items.data.find((entry) => billingItemOfLookupKey(entry.price.lookup_key)?.item === item)?.quantity ?? 0;
  return {
    customerId,
    update: {
      subscriptionId: subscription.id,
      status: subscription.status,
      cycle: billingItemOfLookupKey(first?.price.lookup_key)?.cycle ?? parseBillingCycle(subscription.metadata?.cycle),
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAt: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000)
        : subscription.cancel_at_period_end && periodEnd
          ? new Date(periodEnd * 1000)
          : null,
      billedExtraTeams: quantityOf("team"),
      billedExtraCoaches: quantityOf("coach"),
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
      coachIdOfCustomer: (customerId) => service.coachIdOfCustomer(customerId),
    },
    disconnect: () => database.disconnect(),
  };
}
