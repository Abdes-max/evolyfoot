import { EducatorNotFoundError, InvalidCredentialsError } from "@evolyfoot/database";
import { buildClearedSessionCookie, type PublicAccount } from "./auth";

export interface AccountGateway {
  exportData(accountId: string): Promise<Record<string, unknown>>;
  deleteAccount(accountId: string, password: string): Promise<void>;
}

export function createExportAccountHandler(
  resolveAccount: (request: Request) => Promise<PublicAccount | null>,
  account: Pick<AccountGateway, "exportData">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const current = await resolveAccount(request);
    if (!current) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return new Response(JSON.stringify(await account.exportData(current.id), null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": 'attachment; filename="mes-donnees-evolyfoot.json"',
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export function createDeleteAccountHandler(
  resolveAccount: (request: Request) => Promise<PublicAccount | null>,
  account: Pick<AccountGateway, "deleteAccount">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const current = await resolveAccount(request);
    if (!current) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body: unknown = await request.json().catch(() => null);
    const password = (body as { password?: unknown } | null)?.password;
    if (typeof password !== "string" || !password) {
      return Response.json({ error: "Confirme avec ton mot de passe." }, { status: 400 });
    }
    try {
      await account.deleteAccount(current.id, password);
      const response = Response.json({ status: "ok" });
      response.headers.append("Set-Cookie", buildClearedSessionCookie());
      return response;
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        return Response.json({ error: "Mot de passe incorrect." }, { status: 403 });
      }
      if (error instanceof EducatorNotFoundError) {
        return Response.json({ error: error.message }, { status: 401 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export async function createAccountGateway(): Promise<{ gateway: AccountGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, AccountService, PrismaAccountRepository } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new AccountService(new PrismaAccountRepository(database.prisma));

  return {
    gateway: {
      exportData: (accountId) => service.exportData(accountId),
      deleteAccount: (accountId, password) => service.deleteAccount(accountId, password),
    },
    disconnect: () => database.disconnect(),
  };
}
