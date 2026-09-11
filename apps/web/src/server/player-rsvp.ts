import { EducatorNotFoundError, ValidationError } from "@evolyfoot/database";
import { attendanceStatuses } from "@evolyfoot/domain";
import type { AttendanceStatus } from "@evolyfoot/domain";
import type { PublicAccount } from "./auth";

export interface PlayerRsvpGateway {
  respondToMatch(playerAccountId: string, matchId: string, status: AttendanceStatus, comment?: string | null): Promise<void>;
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
    const comment = typeof body?.comment === "string" && body.comment.trim() ? body.comment.trim().slice(0, 500) : null;
    if (!matchId || !status) {
      return Response.json({ error: "Match et statut sont requis." }, { status: 400 });
    }
    try {
      await rsvp.respondToMatch(account.id, matchId, status, comment);
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
  const { createDatabaseClient, PlayerRsvpService, PrismaEducatorRepository, PrismaMatchRepository, PrismaPlayerRepository } =
    await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new PlayerRsvpService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaPlayerRepository(database.prisma),
    new PrismaMatchRepository(database.prisma),
  );

  return {
    gateway: {
      respondToMatch: (playerAccountId, matchId, status, comment) => service.respondToMatch(playerAccountId, matchId, status, comment),
    },
    disconnect: database.disconnect,
  };
}
