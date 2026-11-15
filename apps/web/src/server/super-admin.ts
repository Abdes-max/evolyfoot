import {
  DuplicateEducatorEmailError,
  EducatorNotFoundError,
  InvalidCredentialsError,
  ValidationError,
  type AdminAuditEntry,
  type AdminEducatorDetail,
  type AdminEducatorFilter,
  type AdminEducatorItem,
  type AdminStats,
  type SuperAdminLogin,
  type SuperAdminRecord,
} from "@evolyfoot/database";
import { databaseErrorResponse } from "./api-errors";
import { buildClearedSessionCookie, buildSessionCookie, readSessionToken } from "./auth";
import { limitByAddress, minute } from "./rate-limit";

// Superadmin : compte séparé des éducateurs, cookie propre (SameSite=Strict, jamais envoyé par un lien
// externe) et aucune route de l'appli éducateur ne le reconnaît. Toutes les routes `/api/super-admin/*`
// passent par `guarded`, sauf la connexion.
export const SUPER_ADMIN_COOKIE_NAME = "evolyfoot_superadmin";

function cookieAttributes(extra: string[]): string[] {
  return process.env.NODE_ENV === "production" ? [...extra, "Secure"] : extra;
}

export function buildSuperAdminCookie(token: string, expiresAt: Date): string {
  return cookieAttributes([`${SUPER_ADMIN_COOKIE_NAME}=${token}`, "Path=/", "HttpOnly", "SameSite=Strict", `Expires=${expiresAt.toUTCString()}`]).join("; ");
}

export function buildClearedSuperAdminCookie(): string {
  return cookieAttributes([`${SUPER_ADMIN_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=0"]).join("; ");
}

export function readSuperAdminToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === SUPER_ADMIN_COOKIE_NAME && rawValue.length > 0) {
      return rawValue.join("=");
    }
  }
  return null;
}

export interface SuperAdminApi {
  login(input: { email: string; password: string }): Promise<SuperAdminLogin>;
  logout(sessionToken: string): Promise<void>;
  getBySession(sessionToken: string): Promise<SuperAdminRecord | null>;
  changePassword(superAdminId: string, input: { currentPassword: string; newPassword: string }, keepSessionToken: string | null): Promise<void>;
  stats(): Promise<AdminStats>;
  listEducators(input: {
    search?: string;
    filter?: AdminEducatorFilter;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: AdminEducatorItem[]; total: number }>;
  getEducator(educatorId: string): Promise<AdminEducatorDetail>;
  suspend(superAdminId: string, educatorId: string, note?: string | null): Promise<void>;
  reactivate(superAdminId: string, educatorId: string, note?: string | null): Promise<void>;
  setTest(superAdminId: string, educatorId: string, isTest: boolean): Promise<void>;
  verifyEmail(superAdminId: string, educatorId: string): Promise<void>;
  extendTrial(superAdminId: string, educatorId: string, days: number, note?: string | null): Promise<Date>;
  deleteEducator(superAdminId: string, educatorId: string, confirmEmail: string): Promise<void>;
  startImpersonation(superAdminId: string, educatorId: string): Promise<{ sessionToken: string; expiresAt: Date }>;
  stopImpersonation(sessionToken: string): Promise<boolean>;
  impersonationOf(sessionToken: string): Promise<{ superAdminEmail: string } | null>;
  listAudit(input: { page?: number; pageSize?: number; action?: string; search?: string }): Promise<{ items: AdminAuditEntry[]; total: number }>;
}

export const educatorActions = ["suspend", "reactivate", "mark-test", "unmark-test", "verify-email", "extend-trial", "impersonate"] as const;
export type EducatorAction = (typeof educatorActions)[number];

const educatorFilters: readonly AdminEducatorFilter[] = ["all", "trial", "subscribed", "expired", "suspended", "test"];

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function positiveInt(value: string | null): number | undefined {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function errorResponse(error: unknown, log: (error: unknown) => void): Response {
  const databaseResponse = databaseErrorResponse(error, log);
  if (databaseResponse) {
    return databaseResponse;
  }
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof EducatorNotFoundError) {
    return Response.json({ error: "Éducateur introuvable." }, { status: 404 });
  }
  if (error instanceof InvalidCredentialsError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof DuplicateEducatorEmailError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

export function createSuperAdminHandlers(api: SuperAdminApi, log: (error: unknown) => void) {
  type Context = { request: Request; superAdmin: SuperAdminRecord; token: string };

  // Garde commune : session superadmin valide, sinon 401. Les erreurs métier sont traduites en une seule place.
  function guarded(run: (context: Context) => Promise<Response>): (request: Request) => Promise<Response> {
    return async (request) => {
      const token = readSuperAdminToken(request);
      if (!token) {
        return Response.json({ error: "Authentification requise." }, { status: 401 });
      }
      try {
        const superAdmin = await api.getBySession(token);
        if (!superAdmin) {
          return Response.json({ error: "Authentification requise." }, { status: 401 });
        }
        return await run({ request, superAdmin, token });
      } catch (error) {
        return errorResponse(error, log);
      }
    };
  }

  return {
    async login(request: Request): Promise<Response> {
      // Plus strict que les éducateurs : 5 essais par adresse et par quart d'heure.
      const tooMany = limitByAddress(request, "super-admin-login", 5, 15 * minute);
      if (tooMany) {
        return tooMany;
      }
      const body = await readJsonBody(request);
      const email = text(body.email);
      const password = text(body.password);
      if (!email || !password) {
        return Response.json({ error: "Adresse e-mail et mot de passe sont obligatoires." }, { status: 400 });
      }
      try {
        const login = await api.login({ email, password });
        return Response.json({ superAdmin: login.superAdmin }, { headers: { "Set-Cookie": buildSuperAdminCookie(login.sessionToken, login.expiresAt) } });
      } catch (error) {
        return errorResponse(error, log);
      }
    },

    async logout(request: Request): Promise<Response> {
      const token = readSuperAdminToken(request);
      if (token) {
        await api.logout(token).catch(log);
      }
      return Response.json({ status: "ok" }, { headers: { "Set-Cookie": buildClearedSuperAdminCookie() } });
    },

    me: guarded(async ({ superAdmin }) => Response.json({ superAdmin })),

    changePassword: guarded(async ({ request, superAdmin, token }) => {
      const body = await readJsonBody(request);
      const currentPassword = text(body.currentPassword);
      const newPassword = text(body.newPassword);
      if (!currentPassword || !newPassword) {
        return Response.json({ error: "Mot de passe actuel et nouveau mot de passe sont obligatoires." }, { status: 400 });
      }
      await api.changePassword(superAdmin.id, { currentPassword, newPassword }, token);
      return Response.json({ status: "ok" });
    }),

    stats: guarded(async () => Response.json({ stats: await api.stats() })),

    listEducators: guarded(async ({ request }) => {
      const params = new URL(request.url).searchParams;
      const filterParam = params.get("filter") as AdminEducatorFilter | null;
      const result = await api.listEducators({
        search: params.get("search") ?? undefined,
        filter: filterParam && educatorFilters.includes(filterParam) ? filterParam : "all",
        page: positiveInt(params.get("page")),
        pageSize: positiveInt(params.get("pageSize")),
      });
      return Response.json(result);
    }),

    getEducator: (request: Request, educatorId: string) => guarded(async () => Response.json({ educator: await api.getEducator(educatorId) }))(request),

    educatorAction: (request: Request, educatorId: string, action: string) =>
      guarded(async ({ request: req, superAdmin }) => {
        if (!(educatorActions as readonly string[]).includes(action)) {
          return Response.json({ error: "Action inconnue." }, { status: 404 });
        }
        const body = await readJsonBody(req);
        const note = text(body.note);
        switch (action as EducatorAction) {
          case "suspend":
            await api.suspend(superAdmin.id, educatorId, note);
            return Response.json({ educator: await api.getEducator(educatorId) });
          case "reactivate":
            await api.reactivate(superAdmin.id, educatorId, note);
            return Response.json({ educator: await api.getEducator(educatorId) });
          case "mark-test":
          case "unmark-test":
            await api.setTest(superAdmin.id, educatorId, action === "mark-test");
            return Response.json({ educator: await api.getEducator(educatorId) });
          case "verify-email":
            await api.verifyEmail(superAdmin.id, educatorId);
            return Response.json({ educator: await api.getEducator(educatorId) });
          case "extend-trial": {
            const days = typeof body.days === "number" ? body.days : Number.NaN;
            await api.extendTrial(superAdmin.id, educatorId, days, note);
            return Response.json({ educator: await api.getEducator(educatorId) });
          }
          case "impersonate": {
            // L'éducateur reçoit son cookie de session normal (30 minutes), le cookie superadmin reste en place.
            const session = await api.startImpersonation(superAdmin.id, educatorId);
            return Response.json({ redirect: "/app" }, { headers: { "Set-Cookie": buildSessionCookie(session.sessionToken, session.expiresAt) } });
          }
        }
      })(request),

    deleteEducator: (request: Request, educatorId: string) =>
      guarded(async ({ request: req, superAdmin }) => {
        const body = await readJsonBody(req);
        await api.deleteEducator(superAdmin.id, educatorId, text(body.confirmEmail) ?? "");
        return Response.json({ status: "ok" });
      })(request),

    auditLog: guarded(async ({ request }) => {
      const params = new URL(request.url).searchParams;
      const result = await api.listAudit({
        page: positiveInt(params.get("page")),
        pageSize: positiveInt(params.get("pageSize")),
        action: params.get("action") ?? undefined,
        search: params.get("search") ?? undefined,
      });
      return Response.json(result);
    }),

    // Appelée depuis l'appli éducateur (bandeau « Quitter ») : c'est le cookie de l'éducateur qui est présenté.
    async stopImpersonation(request: Request): Promise<Response> {
      const token = readSessionToken(request);
      try {
        const stopped = token ? await api.stopImpersonation(token) : false;
        if (!stopped) {
          return Response.json({ error: "Aucune connexion en tant qu'éducateur en cours." }, { status: 400 });
        }
        return Response.json({ redirect: "/super-admin" }, { headers: { "Set-Cookie": buildClearedSessionCookie() } });
      } catch (error) {
        return errorResponse(error, log);
      }
    },
  };
}

export async function createSuperAdminGateway(): Promise<{ api: SuperAdminApi; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, SuperAdminService } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  return { api: new SuperAdminService(database.prisma), disconnect: database.disconnect };
}

export type SuperAdminHandlers = ReturnType<typeof createSuperAdminHandlers>;

// Pour les routes : ouvre la base, exécute le handler, referme.
export async function runSuperAdmin(run: (handlers: SuperAdminHandlers) => Promise<Response>): Promise<Response> {
  const { api, disconnect } = await createSuperAdminGateway();
  try {
    return await run(createSuperAdminHandlers(api, console.error));
  } finally {
    await disconnect();
  }
}

// Superadmin connecté « en tant que » l'éducateur de cette requête, sinon `null`.
export async function impersonationOfRequest(request: Request): Promise<{ superAdminEmail: string } | null> {
  const token = readSessionToken(request);
  if (!token) {
    return null;
  }
  const { api, disconnect } = await createSuperAdminGateway();
  try {
    return await api.impersonationOf(token);
  } catch {
    return null;
  } finally {
    await disconnect();
  }
}

// Pendant une connexion « en tant que », ni suppression de compte, ni mot de passe, ni facturation.
export async function rejectIfImpersonating(request: Request): Promise<Response | null> {
  return (await impersonationOfRequest(request))
    ? Response.json({ error: "Action indisponible pendant une connexion en tant que cet éducateur." }, { status: 403 })
    : null;
}
