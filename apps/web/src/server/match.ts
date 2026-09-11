import { EducatorNotFoundError, MatchNotFoundError } from "@evolyfoot/database";
import type { AttendanceEntry, MatchLineupAssignment, MatchStatus, MatchVenue } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";

export interface MatchSummary {
  id: string;
  opponent: string;
  dateLabel: string;
  // ISO, voir le commentaire sur PersistedMatch.date côté base -- `null` pour un match créé avant
  // l'introduction de ce champ.
  date: string | null;
  meetingTime: string | null;
  location: string | null;
  description: string | null;
  venue: MatchVenue;
  gameFormat: number;
  formationId: string;
  status: MatchStatus;
  lineup: readonly MatchLineupAssignment[];
  captainPlayerId: string | null;
  substitutePlayerIds: readonly string[];
  attendance?: readonly AttendanceEntry[];
}

export interface MatchGateway {
  list(educatorId: string): Promise<MatchSummary[]>;
  get(educatorId: string, matchId: string): Promise<MatchSummary>;
  create(
    educatorId: string,
    input: {
      opponent: string;
      dateLabel: string;
      date?: string | null;
      venue: MatchVenue;
      gameFormat: number;
      formationId?: string;
      meetingTime?: string;
      location?: string;
      description?: string;
    },
  ): Promise<MatchSummary>;
  updateLineup(
    educatorId: string,
    matchId: string,
    input: {
      lineup: readonly MatchLineupAssignment[];
      captainPlayerId: string | null;
      substitutePlayerIds?: readonly string[];
    },
  ): Promise<MatchSummary>;
  updateDetails(
    educatorId: string,
    matchId: string,
    input: { date?: string | null; meetingTime?: string | null; location?: string | null; description?: string | null },
  ): Promise<MatchSummary>;
  changeFormation(educatorId: string, matchId: string, formationId: string): Promise<MatchSummary>;
  markPlayed(educatorId: string, matchId: string, attendance?: readonly AttendanceEntry[]): Promise<MatchSummary>;
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

function isAttendanceEntryShaped(value: unknown): value is AttendanceEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return typeof entry.playerId === "string" && typeof entry.playerName === "string" && typeof entry.present === "boolean";
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
    const date = typeof body?.date === "string" ? body.date : null;
    const venue = body?.venue === "home" || body?.venue === "away" ? body.venue : null;
    const gameFormat = typeof body?.gameFormat === "number" ? body.gameFormat : null;
    const formationId = typeof body?.formationId === "string" ? body.formationId : undefined;
    const meetingTime = typeof body?.meetingTime === "string" ? body.meetingTime : undefined;
    const location = typeof body?.location === "string" ? body.location : undefined;
    const description = typeof body?.description === "string" ? body.description : undefined;
    if (opponent === null || dateLabel === null || venue === null || gameFormat === null) {
      return Response.json({ error: "Adversaire, date, lieu et format de jeu sont requis." }, { status: 400 });
    }

    try {
      const match = await matches.create(educator.id, {
        opponent,
        dateLabel,
        date,
        venue,
        gameFormat,
        formationId,
        meetingTime,
        location,
        description,
      });
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
    // Optionnel côté requête (rétrocompatible avec un client qui n'envoie pas encore ce champ) :
    // absent -> le service garde le banc déjà enregistré, voir MatchService.updateLineup.
    const substitutePlayerIds =
      body?.substitutePlayerIds === undefined
        ? undefined
        : Array.isArray(body.substitutePlayerIds) && body.substitutePlayerIds.every((id) => typeof id === "string")
          ? (body.substitutePlayerIds as string[])
          : null;
    if (lineup === null || captainPlayerId === undefined || substitutePlayerIds === null) {
      return Response.json({ error: "Composition invalide." }, { status: 400 });
    }

    try {
      return Response.json({
        match: await matches.updateLineup(educator.id, matchId, { lineup, captainPlayerId, substitutePlayerIds }),
      });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

// Rendez-vous, lieu et description : modifiables indépendamment de la composition, voir
// MatchService.updateDetails côté base. Chaque champ absent du corps de la requête est laissé
// intact (`undefined`), une valeur `null` explicite l'efface.
export function createUpdateMatchDetailsHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  matches: Pick<MatchGateway, "updateDetails">,
  log: (error: unknown) => void,
): (request: Request, matchId: string) => Promise<Response> {
  return async (request, matchId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await readJsonBody(request);
    const date = body?.date === undefined ? undefined : isNullableString(body.date) ? body.date : null;
    const meetingTime = body?.meetingTime === undefined ? undefined : isNullableString(body.meetingTime) ? body.meetingTime : null;
    const location = body?.location === undefined ? undefined : isNullableString(body.location) ? body.location : null;
    const description = body?.description === undefined ? undefined : isNullableString(body.description) ? body.description : null;
    try {
      return Response.json({ match: await matches.updateDetails(educator.id, matchId, { date, meetingTime, location, description }) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createChangeFormationHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  matches: Pick<MatchGateway, "changeFormation">,
  log: (error: unknown) => void,
): (request: Request, matchId: string) => Promise<Response> {
  return async (request, matchId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await readJsonBody(request);
    const formationId = typeof body?.formationId === "string" ? body.formationId : null;
    if (formationId === null) {
      return Response.json({ error: "Une formation est requise." }, { status: 400 });
    }

    try {
      return Response.json({ match: await matches.changeFormation(educator.id, matchId, formationId) });
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

    // La présence est optionnelle -- marquer un match joué sans avoir saisi qui était là ne doit
    // pas échouer, contrairement à un corps mal formé quand une valeur est bien fournie.
    const body = await readJsonBody(request);
    const rawAttendance = body?.attendance;
    if (rawAttendance !== undefined && !(Array.isArray(rawAttendance) && rawAttendance.every(isAttendanceEntryShaped))) {
      return Response.json({ error: "La présence est invalide." }, { status: 400 });
    }
    const attendance = rawAttendance as readonly AttendanceEntry[] | undefined;

    try {
      return Response.json({ match: await matches.markPlayed(educator.id, matchId, attendance) });
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
      date: match.date ? match.date.toISOString() : null,
      meetingTime: match.meetingTime,
      location: match.location,
      description: match.description,
      venue: match.venue,
      gameFormat: match.gameFormat,
      formationId: match.formationId,
      status: match.status,
      lineup: match.lineup,
      captainPlayerId: match.captainPlayerId,
      substitutePlayerIds: match.substitutePlayerIds,
      ...(match.attendance ? { attendance: match.attendance } : {}),
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
        return toSummary(await service.create(educatorId, { ...input, date: input.date ? new Date(input.date) : null }));
      },
      async updateLineup(educatorId, matchId, input) {
        return toSummary(await service.updateLineup(educatorId, matchId, input));
      },
      async updateDetails(educatorId, matchId, input) {
        const { date, ...rest } = input;
        return toSummary(
          await service.updateDetails(educatorId, matchId, {
            ...rest,
            ...(date !== undefined ? { date: date ? new Date(date) : null } : {}),
          }),
        );
      },
      async changeFormation(educatorId, matchId, formationId) {
        return toSummary(await service.changeFormation(educatorId, matchId, formationId));
      },
      async markPlayed(educatorId, matchId, attendance) {
        return toSummary(await service.markPlayed(educatorId, matchId, attendance));
      },
      remove(educatorId, matchId) {
        return service.remove(educatorId, matchId);
      },
    },
    disconnect: database.disconnect,
  };
}
