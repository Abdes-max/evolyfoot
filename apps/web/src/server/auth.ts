import { DuplicateEducatorEmailError, InvalidCredentialsError, ValidationError } from "@evolyfoot/database";

export const SESSION_COOKIE_NAME = "evolyfoot_session";

export type AccountRole = "coach" | "player";

export interface PublicEducator {
  id: string;
  email: string;
  displayName: string;
}

export interface PublicAccount extends PublicEducator {
  role: AccountRole;
  linkedPlayerId: string | null;
}

export interface AuthenticatedSessionResult {
  educator: PublicEducator;
  sessionToken: string;
  expiresAt: Date;
}

export interface AuthGateway {
  register(input: { email: string; password: string; displayName: string }): Promise<AuthenticatedSessionResult>;
  login(input: { email: string; password: string }): Promise<AuthenticatedSessionResult>;
  logout(sessionToken: string): Promise<void>;
  getEducatorForSession(sessionToken: string): Promise<PublicEducator | null>;
  // Compte quel que soit le rôle (avec `role`), pour /api/auth/session et le cloisonnement.
  getAccountForSession(sessionToken: string): Promise<PublicAccount | null>;
  // Compte "player" uniquement (miroir de getEducatorForSession), pour les routes /api/joueur/*.
  getPlayerAccountForSession(sessionToken: string): Promise<PublicAccount | null>;
}

function cookieAttributes(extra: string[]): string[] {
  return process.env.NODE_ENV === "production" ? [...extra, "Secure"] : extra;
}

export function buildSessionCookie(token: string, expiresAt: Date): string {
  return cookieAttributes([
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ]).join("; ");
}

export function buildClearedSessionCookie(): string {
  return cookieAttributes([`${SESSION_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"]).join("; ");
}

// L'application mobile n'a pas de pot de cookies : elle s'authentifie avec un jeton porteur
// (`Authorization: Bearer <jeton>`) et l'identifie via cet en-tête pour recevoir ce même jeton
// dans le corps de la réponse à l'inscription/la connexion. Le web ne l'envoie jamais et continue
// de s'appuyer uniquement sur le cookie HttpOnly — le jeton ne doit pas être exposé au JS web.
const MOBILE_CLIENT_HEADER = "x-client-platform";
const MOBILE_CLIENT_VALUE = "mobile";

export function isMobileClient(request: Request): boolean {
  return request.headers.get(MOBILE_CLIENT_HEADER) === MOBILE_CLIENT_VALUE;
}

export function readSessionToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    if (token) {
      return token;
    }
  }

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === SESSION_COOKIE_NAME && rawValue.length > 0) {
      return rawValue.join("=");
    }
  }

  return null;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function handleAuthError(error: unknown, log: (error: unknown) => void): Response {
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof DuplicateEducatorEmailError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof InvalidCredentialsError) {
    return Response.json({ error: error.message }, { status: 401 });
  }

  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

export function createRegisterHandler(
  gateway: Pick<AuthGateway, "register">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const body = await readJsonBody(request);
    if (!body || !isNonEmptyString(body.email) || !isNonEmptyString(body.password) || !isNonEmptyString(body.displayName)) {
      return Response.json({ error: "Adresse e-mail, mot de passe et nom sont obligatoires." }, { status: 400 });
    }

    try {
      const session = await gateway.register({
        email: body.email,
        password: body.password,
        displayName: body.displayName,
      });
      const response = Response.json(
        { educator: session.educator, ...(isMobileClient(request) ? { sessionToken: session.sessionToken } : {}) },
        { status: 201 },
      );
      response.headers.append("Set-Cookie", buildSessionCookie(session.sessionToken, session.expiresAt));
      return response;
    } catch (error) {
      return handleAuthError(error, log);
    }
  };
}

export function createLoginHandler(
  gateway: Pick<AuthGateway, "login">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const body = await readJsonBody(request);
    if (!body || !isNonEmptyString(body.email) || !isNonEmptyString(body.password)) {
      return Response.json({ error: "Adresse e-mail et mot de passe sont obligatoires." }, { status: 400 });
    }

    try {
      const session = await gateway.login({ email: body.email, password: body.password });
      const response = Response.json(
        { educator: session.educator, ...(isMobileClient(request) ? { sessionToken: session.sessionToken } : {}) },
        { status: 200 },
      );
      response.headers.append("Set-Cookie", buildSessionCookie(session.sessionToken, session.expiresAt));
      return response;
    } catch (error) {
      return handleAuthError(error, log);
    }
  };
}

export function createLogoutHandler(
  gateway: Pick<AuthGateway, "logout">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const token = readSessionToken(request);
    if (token) {
      try {
        await gateway.logout(token);
      } catch (error) {
        log(error);
      }
    }

    const response = Response.json({ status: "ok" });
    response.headers.append("Set-Cookie", buildClearedSessionCookie());
    return response;
  };
}

export function createSessionHandler(
  gateway: Pick<AuthGateway, "getAccountForSession">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const token = readSessionToken(request);
    if (!token) {
      return Response.json({ educator: null, role: null });
    }

    try {
      const account = await gateway.getAccountForSession(token);
      if (!account) {
        return Response.json({ educator: null, role: null });
      }
      // Un compte "player" n'est jamais exposé comme `educator` (les pages/routes éducateur
      // testent `sessionBody.educator`) ; le client lit `role` pour aiguiller vers /joueur.
      return Response.json({
        educator: account.role === "player" ? null : account,
        role: account.role,
      });
    } catch (error) {
      log(error);
      return Response.json({ educator: null, role: null });
    }
  };
}

function toPublicEducator(educator: { id: string; email: string; displayName: string }): PublicEducator {
  return { id: educator.id, email: educator.email, displayName: educator.displayName };
}

function toPublicAccount(account: {
  id: string;
  email: string;
  displayName: string;
  role?: "coach" | "player";
  linkedPlayerId?: string | null;
}): PublicAccount {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role === "player" ? "player" : "coach",
    linkedPlayerId: account.linkedPlayerId ?? null,
  };
}

// Résout le compte "player" lié à la session, ou null (jeton absent, invalide, ou compte coach).
export async function resolvePlayerAccountFromRequest(request: Request): Promise<PublicAccount | null> {
  const token = readSessionToken(request);
  if (!token) {
    return null;
  }
  const { gateway, disconnect } = await createAuthGateway();
  try {
    return await gateway.getPlayerAccountForSession(token);
  } finally {
    await disconnect();
  }
}

export async function createAuthGateway(): Promise<{ gateway: AuthGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, AuthService, PrismaEducatorRepository, PrismaSessionRepository } = await import(
    "@evolyfoot/database"
  );
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new AuthService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaSessionRepository(database.prisma),
  );

  return {
    gateway: {
      async register(input) {
        const session = await service.register(input);
        return { ...session, educator: toPublicEducator(session.educator) };
      },
      async login(input) {
        const session = await service.login(input);
        return { ...session, educator: toPublicEducator(session.educator) };
      },
      logout: (sessionToken) => service.logout(sessionToken),
      async getEducatorForSession(sessionToken) {
        const educator = await service.getEducatorForSession(sessionToken);
        return educator === null ? null : toPublicEducator(educator);
      },
      async getAccountForSession(sessionToken) {
        const account = await service.getAccountForSession(sessionToken);
        return account === null ? null : toPublicAccount(account);
      },
      async getPlayerAccountForSession(sessionToken) {
        const account = await service.getPlayerAccountForSession(sessionToken);
        return account === null ? null : toPublicAccount(account);
      },
    },
    disconnect: database.disconnect,
  };
}
