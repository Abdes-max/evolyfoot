import type { BillingSummary } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import { billingReminderEmail, subscriptionNoticeEmail } from "./billing-reminders";

function summary(overrides: Partial<BillingSummary> = {}): BillingSummary {
  return {
    coachId: "coach-1",
    email: "c@example.test",
    displayName: "Karim",
    access: { state: "trial", trialEndsAt: new Date("2026-11-25T10:00:00Z"), daysLeft: 3 },
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

describe("rappels d'abonnement par e-mail", () => {
  it("annonce la fin d'essai avec le prix des équipes et adjoints du moment", () => {
    const email = billingReminderEmail(summary(), { kind: "trial-ending", key: "trial-ending" }, "https://evolyfoot.test/");
    expect(email.subject).toBe("Ton essai se termine dans 3 jours — EvolyFoot");
    expect(email.text).toContain("25 novembre 2026");
    expect(email.text).toContain("136 € la saison ou 17,60 € par mois pour 2 équipes et 2 adjoints");
    expect(email.text).toContain("https://evolyfoot.test/abonnement");
  });

  it("rappelle de mettre l'abonnement à jour quand les équipes ou adjoints changent", () => {
    const email = billingReminderEmail(
      summary({ access: { state: "subscribed", status: "active" }, billingCycle: "monthly", billedExtraTeams: 0, billedExtraCoaches: 1 }),
      { kind: "extras", key: "extras:1:2" },
      "https://evolyfoot.test",
    );
    expect(email.subject).toContain("mets à jour ton abonnement");
    expect(email.text).toContain("Tu as maintenant 2 équipes et 2 adjoints, alors que ton abonnement (mensuel) en couvre 1 équipe et 1 adjoint");
    expect(email.text).toContain("17,60 € par mois");
  });

  it("confirme la souscription et la résiliation", () => {
    const subscribed = summary({
      access: { state: "subscribed", status: "trialing" },
      subscriptionStatus: "trialing",
      billingCycle: "season",
      currentPeriodEnd: new Date("2026-11-25T10:00:00Z"),
      billedExtraTeams: 0,
      billedExtraCoaches: 0,
    });
    const started = subscriptionNoticeEmail(subscribed, "started", "https://evolyfoot.test");
    expect(started.subject).toBe("Ton abonnement est confirmé — EvolyFoot");
    expect(started.text).toContain("59 € la saison pour 1 équipe et 0 adjoint");
    expect(started.text).toContain("jusqu’au 25 novembre 2026");
    const canceled = subscriptionNoticeEmail({ ...subscribed, cancelAt: new Date("2026-11-25T10:00:00Z") }, "cancel-scheduled", "https://evolyfoot.test");
    expect(canceled.subject).toBe("Ta résiliation est confirmée — EvolyFoot");
    expect(canceled.text).toContain("accès complet jusqu’au 25 novembre 2026");
  });
});
