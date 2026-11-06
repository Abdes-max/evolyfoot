import { EducatorNotFoundError, ValidationError } from "@evolyfoot/database";
import type { CompetitionKind } from "@evolyfoot/database";
import { attendanceStatuses } from "@evolyfoot/domain";
import type { AttendanceStatus } from "@evolyfoot/domain";
import type { PublicAccount } from "./auth";

export interface PlayerRsvpGateway {
  respondToMatch(playerAccountId: string, matchId: string, status: AttendanceStatus, comment?: string | null): Promise<void>;
  respondToTrainingSession(playerAccountId: string, sessionId: string, status: AttendanceStatus, comment?: string | null): Promise<void>;
  respondToCompetition(playerAccountId: string, kind: CompetitionKind, competitionId: string, status: AttendanceStatus, comment?: string | null): Promise<void>;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && (attendanceStatuses as readonly string[]).includes(value);
}

function readCommentField(body: Record<string, unknown> | null): string | null {
  return typeof body?.comment === "string" && body.comment.trim() ? body.comment.trim().slice(0, 500) : null;
}

// Seule écriture ouverte à un compte "player" -- répondre à sa propre convocation à un match à
// venir, voir PlayerRsvpService côté base.
export function createRespondToMatchHandler(
  resolvePlayerAccount: (request: Request) => Promise<PublicAccount | null>,
  rsvp: Pick<PlayerRsvpGateway, "respondToMatch">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const account = await resolvePlayerAccount(request);
    if (!account) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await readJsonBody(request);
    const matchId = typeof body?.matchId === "string" ? body.matchId : null;
    const status = isAttendanceStatus(body?.status) ? body.status : null;
    if (!matchId || !status) {
      return Response.json({ error: "Match et statut sont requis." }, { status: 400 });
    }
    try {
      await rsvp.respondToMatch(account.id, matchId, status, readCommentField(body));
      return Response.json({ status: "ok" });
    } catch (error) {
      if (error instanceof EducatorNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      if (error instanceof ValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

// Même principe que createRespondToMatchHandler ci-dessus, pour une séance d'entraînement.
export function createRespondToTrainingSessionHandler(
  resolvePlayerAccount: (request: Request) => Promise<PublicAccount | null>,
  rsvp: Pick<PlayerRsvpGateway, "respondToTrainingSession">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const account = await resolvePlayerAccount(request);
    if (!account) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await readJsonBody(request);
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
    const status = isAttendanceStatus(body?.status) ? body.status : null;
    if (!sessionId || !status) {
      return Response.json({ error: "Séance et statut sont requis." }, { status: 400 });
    }
    try {
      await rsvp.respondToTrainingSession(account.id, sessionId, status, readCommentField(body));
      return Response.json({ status: "ok" });
    } catch (error) {
      if (error instanceof EducatorNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      if (error instanceof ValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

// Même principe, pour un tournoi ou un plateau : { kind: "tournament"|"plateau", competitionId, status, comment? }.
export function createRespondToCompetitionHandler(
  resolvePlayerAccount: (request: Request) => Promise<PublicAccount | null>,
  rsvp: Pick<PlayerRsvpGateway, "respondToCompetition">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const account = await resolvePlayerAccount(request);
    if (!account) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await readJsonBody(request);
    const kind = body?.kind === "tournament" || body?.kind === "plateau" ? body.kind : null;
    const competitionId = typeof body?.competitionId === "string" ? body.competitionId : null;
    const status = isAttendanceStatus(body?.status) ? body.status : null;
    if (!kind || !competitionId || !status) {
      return Response.json({ error: "Événement et statut sont requis." }, { status: 400 });
    }
    try {
      await rsvp.respondToCompetition(account.id, kind, competitionId, status, readCommentField(body));
      return Response.json({ status: "ok" });
    } catch (error) {
      if (error instanceof EducatorNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      if (error instanceof ValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export async function createPlayerRsvpGateway(): Promise<{ gateway: PlayerRsvpGateway; disconnect: () => Promise<void> }> {
  const {
    createDatabaseClient,
    CompetitionConvocationService,
    PlayerRsvpService,
    PrismaEducatorRepository,
    PrismaMatchRepository,
    PrismaMessageRepository,
    PrismaPlateauRepository,
    PrismaPlayerRepository,
    PrismaTournamentRepository,
    PrismaTrainingConvocationRepository,
    PrismaTrainingSessionRepository,
  } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const educatorRepository = new PrismaEducatorRepository(database.prisma);
  const playerRepository = new PrismaPlayerRepository(database.prisma);
  const service = new PlayerRsvpService(
    educatorRepository,
    playerRepository,
    new PrismaMatchRepository(database.prisma),
    new PrismaTrainingSessionRepository(database.prisma),
    new PrismaTrainingConvocationRepository(database.prisma),
  );
  // Répondre n'envoie aucun message : le dépôt des messages n'est là que pour le constructeur.
  const competitions = new CompetitionConvocationService(
    educatorRepository,
    playerRepository,
    new PrismaTournamentRepository(database.prisma),
    new PrismaPlateauRepository(database.prisma),
    new PrismaMessageRepository(database.prisma),
  );

  return {
    gateway: {
      respondToMatch: (playerAccountId, matchId, status, comment) => service.respondToMatch(playerAccountId, matchId, status, comment),
      respondToTrainingSession: (playerAccountId, sessionId, status, comment) => service.respondToTrainingSession(playerAccountId, sessionId, status, comment),
      respondToCompetition: (playerAccountId, kind, competitionId, status, comment) =>
        competitions.respond(playerAccountId, kind, competitionId, status, comment),
    },
    disconnect: database.disconnect,
  };
}
