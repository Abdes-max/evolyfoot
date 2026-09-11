import { createAuthGateway, createRegisterHandler, type PublicEducator } from "@/server/auth";
import { createEmailVerificationGateway } from "@/server/email-verification";
import { resolveOrigin } from "@/server/request-origin";

// Envoie le lien de confirmation juste après la création du compte -- en dehors de
// createRegisterHandler (qui reste testable sans dépendre du mailer) : un échec d'envoi ne doit
// jamais faire échouer l'inscription elle-même (voir sendMail(), qui journalise plutôt que de
// lever).
async function sendVerificationEmail(educator: PublicEducator, origin: string): Promise<void> {
  const { gateway, disconnect } = await createEmailVerificationGateway();
  try {
    await gateway.send(educator, origin);
  } finally {
    await disconnect();
  }
}

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createAuthGateway();
  try {
    const response = await createRegisterHandler(gateway, console.error)(request);
    if (response.status === 201) {
      const body: { educator?: PublicEducator } = await response.clone().json();
      if (body.educator) {
        await sendVerificationEmail(body.educator, resolveOrigin(request));
      }
    }
    return response;
  } finally {
    await disconnect();
  }
}
