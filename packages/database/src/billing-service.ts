import { billingAccess, parseBillingCycle, type BillingAccess, type BillingCycle } from "@evolyfoot/domain";
import type { PrismaClient } from "./generated/prisma/client";
import { EducatorNotFoundError } from "./errors";

export interface BillingSummary {
  coachId: string;
  email: string;
  displayName: string;
  access: BillingAccess;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  billingCycle: BillingCycle | null;
  currentPeriodEnd: Date | null;
  // Résiliation programmée : l'accès reste ouvert jusqu'à cette date, sans renouvellement.
  cancelAt: Date | null;
  // Suppléments payés dans l'abonnement en cours, et dernier rappel envoyé par e-mail.
  billedExtraTeams: number | null;
  billedExtraCoaches: number | null;
  lastReminder: string | null;
  // Facturés en plus de la base : équipes au-delà de la première, adjoints de toutes les équipes.
  extraTeams: number;
  extraCoaches: number;
}

export interface SubscriptionUpdate {
  subscriptionId: string;
  status: string;
  cycle: BillingCycle | null;
  currentPeriodEnd: Date | null;
  cancelAt?: Date | null;
  billedExtraTeams?: number | null;
  billedExtraCoaches?: number | null;
}

// Abonnement porté par le compte coach. Un espace d'équipe ou un adjoint renvoie au coach dont il dépend.
export class BillingService {
  constructor(private readonly prisma: PrismaClient) {}

  async coachIdOf(accountId: string): Promise<string> {
    let current = await this.prisma.educator.findUnique({ where: { id: accountId }, select: { id: true, role: true, ownerEducatorId: true } });
    // Adjoint d'un espace d'équipe : deux niveaux au plus.
    for (let depth = 0; current && current.role !== "coach" && depth < 2; depth += 1) {
      if (!current.ownerEducatorId || current.role === "player") break;
      current = await this.prisma.educator.findUnique({ where: { id: current.ownerEducatorId }, select: { id: true, role: true, ownerEducatorId: true } });
    }
    if (!current || current.role !== "coach") {
      throw new EducatorNotFoundError();
    }
    return current.id;
  }

  async summary(accountId: string, now = new Date()): Promise<BillingSummary> {
    const coachId = await this.coachIdOf(accountId);
    const coach = await this.prisma.educator.findUniqueOrThrow({ where: { id: coachId } });
    const teamSpaces = await this.prisma.educator.findMany({ where: { role: "team", ownerEducatorId: coachId }, select: { id: true } });
    const extraCoaches = await this.prisma.educator.count({
      where: { role: "assistant", ownerEducatorId: { in: [coachId, ...teamSpaces.map((space) => space.id)] } },
    });
    return {
      coachId,
      email: coach.email,
      displayName: coach.displayName,
      access: billingAccess({ createdAt: coach.createdAt, trialEndsAt: coach.trialEndsAt, subscriptionStatus: coach.subscriptionStatus, now }),
      stripeCustomerId: coach.stripeCustomerId,
      stripeSubscriptionId: coach.stripeSubscriptionId,
      subscriptionStatus: coach.subscriptionStatus,
      billingCycle: parseBillingCycle(coach.billingCycle),
      currentPeriodEnd: coach.currentPeriodEnd,
      cancelAt: coach.subscriptionCancelAt,
      billedExtraTeams: coach.billedExtraTeams,
      billedExtraCoaches: coach.billedExtraCoaches,
      lastReminder: coach.billingReminder,
      extraTeams: teamSpaces.length,
      extraCoaches,
    };
  }

  // Comptes coach à passer en revue pour les rappels d'abonnement.
  async coachIds(): Promise<string[]> {
    const coaches = await this.prisma.educator.findMany({ where: { role: "coach" }, select: { id: true } });
    return coaches.map((coach) => coach.id);
  }

  async markReminder(coachId: string, key: string): Promise<void> {
    await this.prisma.educator.update({ where: { id: coachId }, data: { billingReminder: key } });
  }

  async setCustomer(coachId: string, stripeCustomerId: string): Promise<void> {
    await this.prisma.educator.update({ where: { id: coachId }, data: { stripeCustomerId } });
  }

  // Appelé par le webhook Stripe. Renvoie false si aucun coach n'a ce client Stripe.
  async applySubscription(stripeCustomerId: string, update: SubscriptionUpdate): Promise<boolean> {
    const result = await this.prisma.educator.updateMany({
      where: { stripeCustomerId },
      data: {
        stripeSubscriptionId: update.subscriptionId,
        subscriptionStatus: update.status,
        billingCycle: update.cycle,
        currentPeriodEnd: update.currentPeriodEnd,
        subscriptionCancelAt: update.cancelAt ?? null,
        billedExtraTeams: update.billedExtraTeams ?? null,
        billedExtraCoaches: update.billedExtraCoaches ?? null,
      },
    });
    return result.count > 0;
  }
}
