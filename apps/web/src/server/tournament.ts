import { EducatorNotFoundError, TournamentNotFoundError } from "@evolyfoot/database";
import type { PublicEducator } from "./auth";

export interface TournamentSummary {
  id: string;
  name: string;
  dateLabel: string;
  // ISO, voir le commentaire sur PersistedTournament.date côté base -- `null` pour une fiche
  // créée avant l'introduction de ce champ.
  date: string | null;
  location: string | null;
  description: string | null;
  result: string | null;
  createdAt: string;
}

export interface TournamentGateway {
  list(educatorId: string): Promise<TournamentSummary[]>;
  get(educatorId: string, tournamentId: string): Promise<TournamentSummary>;
  create(educatorId: string, input: { name: string; dateLabel: string; date?: string | null; result?: string }): Promise<TournamentSummary>;
  updateDetails(
    educatorId: string,
    tournamentId: string,
    input: { date?: string | null; location?: string | null; description?: string | null; result?: string | null },
  ): Promise<TournamentSummary>;
  remove(educatorId: string, tournamentId: string): Promise<void>;
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
  if (error instanceof EducatorNotFoundError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof TournamentNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof Error) {
    // La validation métier (nom/date manquants) échoue avec une Error générique -- voir
    // ValidationError dans @evolyfoot/database.
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

export function createListTournamentsHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  tournaments: Pick<TournamentGateway, "list">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ tournaments: await tournaments.list(educator.id) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createGetTournamentHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  tournaments: Pick<TournamentGateway, "get">,
  log: (error: unknown) => void,
): (request: Request, tournamentId: string) => Promise<Response> {
  return async (request, tournamentId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ tournament: await tournaments.get(educator.id, tournamentId) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createCreateTournamentHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  tournaments: Pick<TournamentGateway, "create">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await readJsonBody(request);
    const name = typeof body?.name === "string" ? body.name : null;
    const dateLabel = typeof body?.dateLabel === "string" ? body.dateLabel : null;
    const date = typeof body?.date === "string" ? body.date : null;
    const result = typeof body?.result === "string" ? body.result : undefined;
    if (name === null || dateLabel === null) {
      return Response.json({ error: "Nom et date sont requis." }, { status: 400 });
    }

    try {
      const tournament = await tournaments.create(educator.id, { name, dateLabel, date, result });
      return Response.json({ tournament }, { status: 201 });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

// Date, lieu, description et bilan -- modifiables indépendamment depuis la fiche détail, même
// principe que createUpdateMatchDetailsHandler côté match.ts.
export function createUpdateTournamentDetailsHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  tournaments: Pick<TournamentGateway, "updateDetails">,
  log: (error: unknown) => void,
): (request: Request, tournamentId: string) => Promise<Response> {
  return async (request, tournamentId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await readJsonBody(request);
    const date = body?.date === undefined ? undefined : isNullableString(body.date) ? body.date : null;
    const location = body?.location === undefined ? undefined : isNullableString(body.location) ? body.location : null;
    const description = body?.description === undefined ? undefined : isNullableString(body.description) ? body.description : null;
    const result = body?.result === undefined ? undefined : isNullableString(body.result) ? body.result : null;
    try {
      return Response.json({
        tournament: await tournaments.updateDetails(educator.id, tournamentId, { date, location, description, result }),
      });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createRemoveTournamentHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  tournaments: Pick<TournamentGateway, "remove">,
  log: (error: unknown) => void,
): (request: Request, tournamentId: string) => Promise<Response> {
  return async (request, tournamentId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      await tournaments.remove(educator.id, tournamentId);
      return Response.json({ status: "ok" });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export async function createTournamentGateway(): Promise<{ gateway: TournamentGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, PrismaEducatorRepository, PrismaTournamentRepository, TournamentService } = await import(
    "@evolyfoot/database"
  );
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new TournamentService(new PrismaEducatorRepository(database.prisma), new PrismaTournamentRepository(database.prisma));

  function toSummary(tournament: Awaited<ReturnType<typeof service.create>>): TournamentSummary {
    return {
      id: tournament.id,
      name: tournament.name,
      dateLabel: tournament.dateLabel,
      date: tournament.date ? tournament.date.toISOString() : null,
      location: tournament.location,
      description: tournament.description,
      result: tournament.result,
      createdAt: tournament.createdAt.toISOString(),
    };
  }

  return {
    gateway: {
      async list(educatorId) {
        const tournaments = await service.list(educatorId);
        return tournaments.map(toSummary);
      },
      async get(educatorId, tournamentId) {
        const tournament = await service.getById(educatorId, tournamentId);
        if (!tournament) {
          throw new TournamentNotFoundError();
        }
        return toSummary(tournament);
      },
      async create(educatorId, input) {
        return toSummary(await service.create(educatorId, { ...input, date: input.date ? new Date(input.date) : null }));
      },
      async updateDetails(educatorId, tournamentId, input) {
        const { date, ...rest } = input;
        return toSummary(
          await service.updateDetails(educatorId, tournamentId, {
            ...rest,
            ...(date !== undefined ? { date: date ? new Date(date) : null } : {}),
          }),
        );
      },
      remove(educatorId, tournamentId) {
        return service.remove(educatorId, tournamentId);
      },
    },
    disconnect: database.disconnect,
  };
}
