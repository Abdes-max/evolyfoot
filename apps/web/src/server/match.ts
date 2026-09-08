import { EducatorNotFoundError, MatchNotFoundError } from "@evolyfoot/database";
import type { MatchLineupAssignment, MatchStatus, MatchVenue } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";

export interface MatchSummary {
  id: string;
  opponent: string;
  dateLabel: string;
  venue: MatchVenue;
  gameFormat: number;
  status: MatchStatus;
  lineup: readonly MatchLineupAssignment[];
  captainPlayerId: string | null;
}

export interface MatchGateway {
  list(educatorId: string): Promise<MatchSummary[]>;
  get(educatorId: string, matchId: string): Promise<MatchSummary>;
  create(educatorId: string, input: { opponent: string; dateLabel: string; venue: MatchVenue; gameFormat: number }): Promise<MatchSummary>;
  updateLineup(
    educatorId: string,
    matchId: string,
    input: { lineup: readonly MatchLineupAssignment[]; captainPlayerId: string | null },
  ): Promise<MatchSummary>;
  markPlayed(educatorId: string, matchId: string): Promise<MatchSummary>;
  remove(educatorId: string, matchId: string): Promise<void>;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isLineupAssignmentShaped(value: unknown): value is MatchLineupAssignment {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const assignment = value as Record<string, unknown>;
  return typeof assignment.slotId === "string" && typeof assignment.playerId === "string" && typeof assignment.playerName === "string";
}

function errorResponse(error: unknown, log: (error: unknown) => void): Response {
  if (error instanceof EducatorNotFoundError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof MatchNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof Error) {
    // La validation métier (adversaire vide, poste inconnu, capitaine hors composition...)
    // échoue avec une Error générique -- voir ValidationError dans @evolyfoot/database.
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

export function createListMatchesHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  matches: Pick<MatchGateway, "list">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ matches: await matches.list(educator.id) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createCreateMatchHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  matches: Pick<MatchGateway, "create">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await readJsonBody(request);
    const opponent = typeof body?.opponent === "string" ? body.opponent : null;
    const dateLabel = typeof body?.dateLabel === "string" ? body.dateLabel : null;
    const venue = body?.venue === "home" || body?.venue === "away" ? body.venue : null;
    const gameFormat = typeof body?.gameFormat === "number" ? body.gameFormat : null;
    if (opponent === null || dateLabel === null || venue === null || gameFormat === null) {
      return Response.json({ error: "Adversaire, date, lieu et format de jeu sont requis." }, { status: 400 });
    }

    try {
      const match = await matches.create(educator.id, { opponent, dateLabel, venue, gameFormat });
      return Response.json({ match }, { status: 201 });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createGetMatchHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  matches: Pick<MatchGateway, "get">,
  log: (error: unknown) => void,
): (request: Request, matchId: string) => Promise<Response> {
  return async (request, matchId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ match: await matches.get(educator.id, matchId) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createUpdateLineupHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  matches: Pick<MatchGateway, "updateLineup">,
  log: (error: unknown) => void,
): (request: Request, matchId: string) => Promise<Response> {
  return async (request, matchId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await readJsonBody(request);
    const lineup = Array.isArray(body?.lineup) && body.lineup.every(isLineupAssignmentShaped) ? (body.lineup as MatchLineupAssignment[]) : null;
    const captainPlayerId = body?.captainPlayerId === null || typeof body?.captainPlayerId === "string" ? (body.captainPlayerId as string | null) : undefined;
    if (lineup === null || captainPlayerId === undefined) {
      return Response.json({ error: "Composition invalide." }, { status: 400 });
    }

    try {
      return Response.json({ match: await matches.updateLineup(educator.id, matchId, { lineup, captainPlayerId }) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createMarkPlayedHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  matches: Pick<MatchGateway, "markPlayed">,
  log: (error: unknown) => void,
): (request: Request, matchId: string) => Promise<Response> {
  return async (request, matchId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ match: await matches.markPlayed(educator.id, matchId) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createRemoveMatchHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  matches: Pick<MatchGateway, "remove">,
  log: (error: unknown) => void,
): (request: Request, matchId: string) => Promise<Response> {
  return async (request, matchId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      await matches.remove(educator.id, matchId);
      return Response.json({ status: "ok" });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export async function createMatchGateway(): Promise<{ gateway: MatchGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, MatchService, PrismaEducatorRepository, PrismaMatchRepository } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new MatchService(new PrismaEducatorRepository(database.prisma), new PrismaMatchRepository(database.prisma));

  function toSummary(match: Awaited<ReturnType<typeof service.get>>): MatchSummary {
    return {
      id: match.id,
      opponent: match.opponent,
      dateLabel: match.dateLabel,
      venue: match.venue,
      gameFormat: match.gameFormat,
      status: match.status,
      lineup: match.lineup,
      captainPlayerId: match.captainPlayerId,
    };
  }

  return {
    gateway: {
      async list(educatorId) {
        const matches = await service.list(educatorId);
        return matches.map(toSummary);
      },
      async get(educatorId, matchId) {
        return toSummary(await service.get(educatorId, matchId));
      },
      async create(educatorId, input) {
        return toSummary(await service.create(educatorId, input));
      },
      async updateLineup(educatorId, matchId, input) {
        return toSummary(await service.updateLineup(educatorId, matchId, input));
      },
      async markPlayed(educatorId, matchId) {
        return toSummary(await service.markPlayed(educatorId, matchId));
      },
      remove(educatorId, matchId) {
        return service.remove(educatorId, matchId);
      },
    },
    disconnect: database.disconnect,
  };
}
