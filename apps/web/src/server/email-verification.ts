import { VerificationInvalidError } from "@evolyfoot/database";
import type { PublicEducator } from "./auth";
import { renderVerificationEmail, sendMail } from "./mailer";
import { resolveOrigin } from "./request-origin";

export interface EmailVerificationGateway {
  // Génère un jeton et envoie le lien de confirmation. Ne lève jamais -- un envoi raté (SMTP mal
  // configuré, relais indisponible) ne doit pas casser l'inscription ni le renvoi manuel, voir
  // sendMail().
  send(input: { id: string; email: string; displayName: string }, origin: string): Promise<void>;
  // Marque le compte confirmé. `null` si le jeton est invalide/expiré.
  consume(token: string): Promise<{ displayName: string } | null>;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function createConsumeVerificationHandler(
  gateway: Pick<EmailVerificationGateway, "consume">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const body = await readJsonBody(request);
    const token = typeof body?.token === "string" ? body.token : null;
    if (!token) {
      return Response.json({ error: "Lien de confirmation invalide." }, { status: 400 });
    }
    try {
      const result = await gateway.consume(token);
      if (!result) {
        return Response.json({ error: "Ce lien de confirmation n’est plus valide." }, { status: 410 });
      }
      return Response.json({ status: "ok", displayName: result.displayName });
    } catch (error) {
      if (error instanceof VerificationInvalidError) {
        return Response.json({ error: error.message }, { status: 410 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

// Renvoie un nouveau lien à l'éducateur connecté (bannière "confirme ton e-mail" -> bouton
// renvoyer). Toujours 200 quel que soit le résultat de l'envoi lui-même (voir send()) : du point
// de vue du client, la demande a été prise en compte.
export function createResendVerificationHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  gateway: Pick<EmailVerificationGateway, "send">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      await gateway.send(educator, resolveOrigin(request));
      return Response.json({ status: "ok" });
    } catch (error) {
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export async function createEmailVerificationGateway(): Promise<{
  gateway: EmailVerificationGateway;
  disconnect: () => Promise<void>;
}> {
  const { createDatabaseClient, EmailVerificationService, PrismaEducatorRepository, PrismaEmailVerificationRepository } =
    await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new EmailVerificationService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaEmailVerificationRepository(database.prisma),
  );

  return {
    gateway: {
      async send(input, origin) {
        const created = await service.create(input.id);
        const verifyUrl = `${origin}/verifier-email/${created.token}`;
        await sendMail({ to: input.email, ...renderVerificationEmail(input.displayName, verifyUrl) });
      },
      async consume(token) {
        try {
          const educator = await service.consume(token);
          return { displayName: educator.displayName };
        } catch (error) {
          if (error instanceof VerificationInvalidError) {
            return null;
          }
          throw error;
        }
      },
    },
    disconnect: database.disconnect,
  };
}
