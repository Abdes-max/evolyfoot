import { InviteInvalidError, PlayerAccountExistsError } from "@evolyfoot/database";
import { EducatorNotFoundError, PlayerNotFoundError, ValidationError } from "@evolyfoot/database";
import { buildSessionCookie, type PublicAccount, type PublicEducator } from "./auth";
import { resolveOrigin } from "./request-origin";

export interface InvitePreviewSummary {
  playerName: string;
  teamName: string | null;
  coachName: string;
}

export interface CreatedInviteSummary {
  token: string;
  expiresAt: string;
}

export interface PlayerInviteGateway {
  create(educatorId: string, playerId: string): Promise<CreatedInviteSummary>;
  preview(token: string): Promise<InvitePreviewSummary | null>;
  consume(
    token: string,
    input: { email: string; password: string; displayName: string },
  ): Promise<{ account: PublicAccount; sessionToken: string; expiresAt: Date }>;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function errorResponse(error: unknown, log: (error: unknown) => void): Response {
  if (error instanceof EducatorNotFoundError || error instanceof PlayerNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PlayerAccountExistsError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof InviteInvalidError) {
    return Response.json({ error: error.message }, { status: 410 });
  }
  if (error instanceof ValidationError || error instanceof Error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

export function createCreateInviteHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  invites: Pick<PlayerInviteGateway, "create">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await readJsonBody(request);
    const playerId = typeof body?.playerId === "string" ? body.playerId : null;
    if (!playerId) {
      return Response.json({ error: "Le joueur est requis." }, { status: 400 });
    }
    try {
      const invite = await invites.create(educator.id, playerId);
      const url = `${resolveOrigin(request)}/rejoindre/${invite.token}`;
      return Response.json({ url, expiresAt: invite.expiresAt }, { status: 201 });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createPreviewInviteHandler(
  invites: Pick<PlayerInviteGateway, "preview">,
  log: (error: unknown) => void,
): (request: Request, token: string) => Promise<Response> {
  return async (_request, token) => {
    try {
      const preview = await invites.preview(token);
      if (!preview) {
        return Response.json({ error: "Cette invitation n’est plus valide." }, { status: 404 });
      }
      return Response.json({ invite: preview });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createConsumeInviteHandler(
  invites: Pick<PlayerInviteGateway, "consume">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const body = await readJsonBody(request);
    const token = typeof body?.token === "string" ? body.token : null;
    const email = typeof body?.email === "string" ? body.email : null;
    const password = typeof body?.password === "string" ? body.password : null;
    const displayName = typeof body?.displayName === "string" ? body.displayName : null;
    if (!token || !email || !password || !displayName) {
      return Response.json({ error: "Tous les champs sont requis." }, { status: 400 });
    }
    try {
      const { account, sessionToken, expiresAt } = await invites.consume(token, { email, password, displayName });
      const response = Response.json({ account }, { status: 201 });
      response.headers.append("Set-Cookie", buildSessionCookie(sessionToken, expiresAt));
      return response;
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export async function createPlayerInviteGateway(): Promise<{
  gateway: PlayerInviteGateway;
  disconnect: () => Promise<void>;
}> {
  const {
    createDatabaseClient,
    AuthService,
    PlayerInviteService,
    PrismaEducatorRepository,
    PrismaPlayerInviteRepository,
    PrismaPlayerRepository,
    PrismaSessionRepository,
    PrismaTeamRepository,
  } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const authService = new AuthService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaSessionRepository(database.prisma),
  );
  const service = new PlayerInviteService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaPlayerRepository(database.prisma),
    new PrismaPlayerInviteRepository(database.prisma),
    new PrismaTeamRepository(database.prisma),
    authService,
  );

  return {
    gateway: {
      async create(educatorId, playerId) {
        const invite = await service.create(educatorId, playerId);
        return { token: invite.token, expiresAt: invite.expiresAt.toISOString() };
      },
      preview: (token) => service.preview(token),
      async consume(token, input) {
        const session = await service.consume(token, input);
        return {
          account: {
            id: session.educator.id,
            email: session.educator.email,
            displayName: session.educator.displayName,
            role: session.educator.role === "player" ? "player" : "coach",
            linkedPlayerId: session.educator.linkedPlayerId ?? null,
            // Pas de boucle de confirmation par e-mail pour les comptes tuteur/joueur (créés via
            // un lien d'invitation, déjà vérifié par construction) -- jamais de bannière ici.
            emailVerified: true,
          },
          sessionToken: session.sessionToken,
          expiresAt: session.expiresAt,
        };
      },
    },
    disconnect: database.disconnect,
  };
}
