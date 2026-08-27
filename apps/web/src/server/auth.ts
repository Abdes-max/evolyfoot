import { DuplicateEducatorEmailError, InvalidCredentialsError, ValidationError } from "@evolyfoot/database";

export const SESSION_COOKIE_NAME = "evolyfoot_session";

export interface PublicEducator {
  id: string;
  email: string;
  displayName: string;
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

export function readSessionToken(request: Request): string | null {
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
      const response = Response.json({ educator: session.educator }, { status: 201 });
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
      const response = Response.json({ educator: session.educator }, { status: 200 });
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
  gateway: Pick<AuthGateway, "getEducatorForSession">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const token = readSessionToken(request);
    if (!token) {
      return Response.json({ educator: null });
    }

    try {
      const educator = await gateway.getEducatorForSession(token);
      return Response.json({ educator });
    } catch (error) {
      log(error);
      return Response.json({ educator: null });
    }
  };
}

function toPublicEducator(educator: { id: string; email: string; displayName: string }): PublicEducator {
  return { id: educator.id, email: educator.email, displayName: educator.displayName };
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
    },
    disconnect: database.disconnect,
  };
}
