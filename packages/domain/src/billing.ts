// Abonnement EvolyFoot : pas d'offre gratuite, un essai de 14 jours sans carte, puis on paie dès le
// premier coach et la première équipe. Les équipes et les coachs (adjoints) en plus coûtent moins cher.
// Deux rythmes : au mois, ou à la saison (payée en une fois, renouvelée chaque année).
export type BillingCycle = "monthly" | "season";
export type BillingItem = "base" | "team" | "coach";

export const billingCycles: readonly BillingCycle[] = ["monthly", "season"];

export const trialDays = 14;

// Prix TTC en euros.
export const billingPrices: Record<BillingItem, Record<BillingCycle, number>> = {
  base: { monthly: 7.9, season: 59 },
  team: { monthly: 3.9, season: 29 },
  coach: { monthly: 2.9, season: 24 },
};

export const billingItemLabels: Record<BillingItem, string> = {
  base: "EvolyFoot Coach : 1 coach et 1 équipe",
  team: "Équipe supplémentaire",
  coach: "Coach supplémentaire",
};

export const billingCycleLabels: Record<BillingCycle, string> = { monthly: "Mensuel", season: "À la saison" };

export function parseBillingCycle(value: unknown): BillingCycle | null {
  return value === "monthly" || value === "season" ? value : null;
}

// Clé de recherche du prix chez Stripe : le serveur crée le prix au premier besoin, puis le retrouve par cette clé.
export function billingPriceLookupKey(item: BillingItem, cycle: BillingCycle): string {
  return `evolyfoot_${item}_${cycle}`;
}

export function billingItemOfLookupKey(key: string | null | undefined): { item: BillingItem; cycle: BillingCycle } | null {
  const match = key?.match(/^evolyfoot_(base|team|coach)_(monthly|season)$/);
  return match ? { item: match[1] as BillingItem, cycle: match[2] as BillingCycle } : null;
}

export interface BillingLine {
  item: BillingItem;
  quantity: number;
  unitPrice: number;
}

// Lignes de l'abonnement : toujours la base, puis les équipes et coachs en plus quand il y en a.
export function billingLines(cycle: BillingCycle, extraTeams: number, extraCoaches: number): BillingLine[] {
  const lines: BillingLine[] = [{ item: "base", quantity: 1, unitPrice: billingPrices.base[cycle] }];
  if (extraTeams > 0) lines.push({ item: "team", quantity: extraTeams, unitPrice: billingPrices.team[cycle] });
  if (extraCoaches > 0) lines.push({ item: "coach", quantity: extraCoaches, unitPrice: billingPrices.coach[cycle] });
  return lines;
}

export function billingTotal(lines: readonly BillingLine[]): number {
  return Math.round(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * 100, 0)) / 100;
}

// Statuts Stripe qui donnent accès à l'appli. « past_due » laisse le temps de régler un paiement refusé.
const payingStatuses = new Set(["active", "trialing", "past_due"]);

export type BillingAccess =
  { state: "subscribed"; status: string } | { state: "trial"; trialEndsAt: Date; daysLeft: number } | { state: "expired"; trialEndsAt: Date };

// Fin de l'essai : la date enregistrée (comptes créés avant le paiement) ou 14 jours après l'inscription.
export function trialEndOf(createdAt: Date, trialEndsAt: Date | null): Date {
  return trialEndsAt ?? new Date(createdAt.getTime() + trialDays * 24 * 60 * 60 * 1000);
}

export function billingAccess(input: { createdAt: Date; trialEndsAt: Date | null; subscriptionStatus: string | null; now: Date }): BillingAccess {
  if (input.subscriptionStatus && payingStatuses.has(input.subscriptionStatus)) {
    return { state: "subscribed", status: input.subscriptionStatus };
  }
  const trialEndsAt = trialEndOf(input.createdAt, input.trialEndsAt);
  const remaining = trialEndsAt.getTime() - input.now.getTime();
  if (remaining > 0) {
    return { state: "trial", trialEndsAt, daysLeft: Math.ceil(remaining / (24 * 60 * 60 * 1000)) };
  }
  return { state: "expired", trialEndsAt };
}
