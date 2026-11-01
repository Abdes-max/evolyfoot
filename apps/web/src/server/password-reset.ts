import { PasswordResetInvalidError, ValidationError } from "@evolyfoot/database";
import { renderPasswordResetEmail, sendMail } from "./mailer";
import { resolveOrigin } from "./request-origin";

export interface PasswordResetGateway {
  request(email: string, origin: string): Promise<void>;
  reset(token: string, password: string): Promise<void>;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Réponse identique que le compte existe ou non, pour ne pas révéler les adresses inscrites.
export function createForgotPasswordHandler(
  gateway: Pick<PasswordResetGateway, "request">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const body = await readJsonBody(request);
    if (typeof body?.email !== "string" || !body.email.trim()) {
      return Response.json({ error: "Indique ton adresse e-mail." }, { status: 400 });
    }
    try {
      await gateway.request(body.email, resolveOrigin(request));
    } catch (error) {
      log(error);
    }
    return Response.json({ status: "ok" });
  };
}

export function createResetPasswordHandler(
  gateway: Pick<PasswordResetGateway, "reset">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const body = await readJsonBody(request);
    if (typeof body?.token !== "string" || typeof body.password !== "string") {
      return Response.json({ error: "Le lien ou le mot de passe est manquant." }, { status: 400 });
    }
    try {
      await gateway.reset(body.token, body.password);
      return Response.json({ status: "ok" });
    } catch (error) {
      if (error instanceof PasswordResetInvalidError) {
        return Response.json({ error: error.message }, { status: 410 });
      }
      if (error instanceof ValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export async function createPasswordResetGateway(): Promise<{ gateway: PasswordResetGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, PasswordResetService, PrismaEducatorRepository, PrismaPasswordResetRepository } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new PasswordResetService(new PrismaEducatorRepository(database.prisma), new PrismaPasswordResetRepository(database.prisma));

  return {
    gateway: {
      async request(email, origin) {
        const created = await service.request(email);
        if (created) {
          // Sans await : le temps de réponse ne doit pas trahir qu'un e-mail est parti.
          void sendMail({
            to: created.email,
            ...renderPasswordResetEmail(created.displayName, `${origin}/reinitialiser-mot-de-passe/${created.token}`),
          });
        }
      },
      reset: (token, password) => service.reset(token, password),
    },
    disconnect: database.disconnect,
  };
}
