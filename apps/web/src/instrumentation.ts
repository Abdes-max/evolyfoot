// Planificateur des convocations automatiques aux entraînements : un passage toutes les 10 minutes
// dans le serveur Node (un seul conteneur en production). Coupé en test et sans base configurée.
// Les rappels d'abonnement par e-mail (fin d'essai, suppléments) passent une fois par heure, et
// seulement quand le paiement Stripe est configuré.
const convocationInterval = 10 * 60 * 1000;
const remindersEvery = 6;

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV === "test" || !process.env.DATABASE_URL || process.env.CONVOCATION_SCHEDULER === "off") {
    return;
  }
  const { sendDueTrainingConvocations } = await import("./server/training-convocation");
  const { sendBillingReminders } = await import("./server/billing-reminders");
  let running = false;
  let ticks = 0;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await sendDueTrainingConvocations();
    } catch (error) {
      console.error("Convocations automatiques :", error);
    }
    try {
      if (ticks % remindersEvery === 0 && process.env.STRIPE_SECRET_KEY) await sendBillingReminders();
    } catch (error) {
      console.error("Rappels d’abonnement :", error);
    } finally {
      ticks += 1;
      running = false;
    }
  };
  setTimeout(() => void tick(), 30_000);
  setInterval(() => void tick(), convocationInterval);
}
