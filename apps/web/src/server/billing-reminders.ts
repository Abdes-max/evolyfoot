import type { BillingSummary } from "@evolyfoot/database";
import { billingCycleLabels, billingLines, billingReminderDue, billingTotal, type BillingCycle, type BillingReminder } from "@evolyfoot/domain";
import type { SubscriptionNotice } from "./billing";
import { renderBillingReminderEmail, sendMail } from "./mailer";

function euros(value: number): string {
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} €`;
}

function longDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

// « 2 équipes et 1 adjoint » : la première équipe est comprise dans la base.
function teamSummary(extraTeams: number, extraCoaches: number): string {
  return `${plural(extraTeams + 1, "équipe")} et ${plural(extraCoaches, "adjoint")}`;
}

function quote(summary: BillingSummary, cycle: BillingCycle): string {
  return `${euros(billingTotal(billingLines(cycle, summary.extraTeams, summary.extraCoaches)))} ${cycle === "monthly" ? "par mois" : "la saison"}`;
}

// Contenu du rappel : le montant tient compte des équipes et adjoints du moment.
export function billingReminderEmail(summary: BillingSummary, reminder: BillingReminder, baseUrl: string): { subject: string; html: string; text: string } {
  const url = `${baseUrl.replace(/\/$/, "")}/abonnement`;
  const team = teamSummary(summary.extraTeams, summary.extraCoaches);
  const prices = `${quote(summary, "season")} ou ${quote(summary, "monthly")}`;
  if (reminder.kind === "trial-ending" && summary.access.state === "trial") {
    const { daysLeft, trialEndsAt } = summary.access;
    return renderBillingReminderEmail(
      summary.displayName,
      `Ton essai se termine dans ${plural(daysLeft, "jour")}`,
      `Ton essai gratuit se termine le ${longDate(trialEndsAt)}. Pour continuer à préparer tes séances sans interruption, choisis ton abonnement sur le site : ${prices} pour ${team}. Le premier prélèvement attend la fin de l’essai.`,
      "Choisir mon abonnement",
      url,
    );
  }
  if (reminder.kind === "trial-ended") {
    return renderBillingReminderEmail(
      summary.displayName,
      "Ton essai est terminé",
      `Ton essai gratuit est terminé. Tes séances, ta saison et tes joueurs t’attendent : abonne-toi sur le site pour continuer, ${prices} pour ${team}.`,
      "M’abonner",
      url,
    );
  }
  const cycle = summary.billingCycle ?? "season";
  return renderBillingReminderEmail(
    summary.displayName,
    "Tes équipes ont changé : mets à jour ton abonnement",
    `Tu as maintenant ${team}, alors que ton abonnement (${billingCycleLabels[cycle].toLowerCase()}) en couvre ${teamSummary(summary.billedExtraTeams ?? 0, summary.billedExtraCoaches ?? 0)}. Mets-le à jour en un clic sur la page Abonnement : ${quote(summary, cycle)}, ajusté au prorata.`,
    "Mettre à jour mon abonnement",
    url,
  );
}

// E-mail de suivi de l'abonnement (souscription, résiliation, reprise, fin), d'après l'état déjà enregistré.
export function subscriptionNoticeEmail(summary: BillingSummary, notice: SubscriptionNotice, baseUrl: string): { subject: string; html: string; text: string } {
  const url = `${baseUrl.replace(/\/$/, "")}/abonnement`;
  const cycle = summary.billingCycle ?? "season";
  const billed = `${euros(billingTotal(billingLines(cycle, summary.billedExtraTeams ?? 0, summary.billedExtraCoaches ?? 0)))} ${cycle === "monthly" ? "par mois" : "la saison"}`;
  const team = teamSummary(summary.billedExtraTeams ?? 0, summary.billedExtraCoaches ?? 0);
  if (notice === "started") {
    const next =
      summary.subscriptionStatus === "trialing" && summary.currentPeriodEnd
        ? `Ton essai gratuit continue jusqu’au ${longDate(summary.currentPeriodEnd)} : le premier prélèvement aura lieu ce jour-là, et ta facture t’arrivera par e-mail.`
        : "Ta facture est disponible dans « Gérer mon abonnement ».";
    return renderBillingReminderEmail(
      summary.displayName,
      "Ton abonnement est confirmé",
      `Merci pour ta confiance ! Ton abonnement EvolyFoot (${billingCycleLabels[cycle].toLowerCase()}) est en place : ${billed} pour ${team}. ${next}`,
      "Voir mon abonnement",
      url,
    );
  }
  if (notice === "cancel-scheduled") {
    const until = summary.cancelAt ? ` jusqu’au ${longDate(summary.cancelAt)}` : " jusqu’à la fin de la période en cours";
    return renderBillingReminderEmail(
      summary.displayName,
      "Ta résiliation est confirmée",
      `Ta résiliation est bien prise en compte : plus aucun prélèvement ne sera fait. Tu gardes l’accès complet${until}, et tu peux reprendre ton abonnement d’ici là depuis la page Abonnement.`,
      "Voir mon abonnement",
      url,
    );
  }
  if (notice === "resumed") {
    const renewal = summary.currentPeriodEnd ? ` Prochaine échéance : le ${longDate(summary.currentPeriodEnd)}.` : "";
    return renderBillingReminderEmail(
      summary.displayName,
      "Ton abonnement continue",
      `Ta résiliation est annulée : ton abonnement EvolyFoot continue, ${billed} pour ${team}.${renewal}`,
      "Voir mon abonnement",
      url,
    );
  }
  return renderBillingReminderEmail(
    summary.displayName,
    "Ton abonnement est terminé",
    "Ton abonnement EvolyFoot est terminé. Tes séances, ta saison et tes joueurs restent enregistrés : tu peux te réabonner à tout moment sur le site pour les retrouver.",
    "Me réabonner",
    url,
  );
}

export async function sendSubscriptionNotice(summary: BillingSummary, notice: SubscriptionNotice): Promise<void> {
  const baseUrl = process.env.APP_URL?.trim() || "http://localhost:3000";
  await sendMail({ to: summary.email, ...subscriptionNoticeEmail(summary, notice, baseUrl) });
}

// Passage du planificateur (voir instrumentation.ts) : envoie les rappels dus, une fois chacun.
export async function sendBillingReminders(now: Date = new Date()): Promise<number> {
  const { createDatabaseClient, BillingService } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const baseUrl = process.env.APP_URL?.trim() || "http://localhost:3000";
  let sent = 0;
  try {
    const service = new BillingService(database.prisma);
    for (const coachId of await service.coachIds()) {
      const summary = await service.summary(coachId, now);
      const reminder = billingReminderDue({ ...summary, everSubscribed: summary.stripeSubscriptionId !== null, now });
      if (!reminder) continue;
      await service.markReminder(coachId, reminder.key);
      await sendMail({ to: summary.email, ...billingReminderEmail(summary, reminder, baseUrl) });
      sent += 1;
    }
    return sent;
  } finally {
    await database.disconnect();
  }
}
