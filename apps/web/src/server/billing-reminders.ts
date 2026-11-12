import type { BillingSummary } from "@evolyfoot/database";
import { billingCycleLabels, billingLines, billingReminderDue, billingTotal, type BillingCycle, type BillingReminder } from "@evolyfoot/domain";
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
