// Planificateur des convocations automatiques aux entraînements : un passage toutes les 10 minutes
// dans le serveur Node (un seul conteneur en production). Coupé en test et sans base configurée.
const convocationInterval = 10 * 60 * 1000;

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV === "test" || !process.env.DATABASE_URL || process.env.CONVOCATION_SCHEDULER === "off") {
    return;
  }
  const { sendDueTrainingConvocations } = await import("./server/training-convocation");
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await sendDueTrainingConvocations();
    } catch (error) {
      console.error("Convocations automatiques :", error);
    } finally {
      running = false;
    }
  };
  setTimeout(() => void tick(), 30_000);
  setInterval(() => void tick(), convocationInterval);
}
