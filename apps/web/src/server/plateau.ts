import { EducatorNotFoundError, PlateauNotFoundError } from "@evolyfoot/database";
import type { PublicEducator } from "./auth";

export interface PlateauSummary {
  id: string;
  name: string;
  dateLabel: string;
  date: string | null;
  location: string | null;
  description: string | null;
  result: string | null;
  createdAt: string;
}

export interface PlateauGateway {
  list(educatorId: string): Promise<PlateauSummary[]>;
  get(educatorId: string, plateauId: string): Promise<PlateauSummary>;
  create(educatorId: string, input: { name: string; dateLabel: string; date?: string | null; result?: string }): Promise<PlateauSummary>;
  updateDetails(
    educatorId: string,
    plateauId: string,
    input: { date?: string | null; location?: string | null; description?: string | null; result?: string | null },
  ): Promise<PlateauSummary>;
  remove(educatorId: string, plateauId: string): Promise<void>;
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
  if (error instanceof PlateauNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof Error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

export function createListPlateauxHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  plateaux: Pick<PlateauGateway, "list">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ plateaux: await plateaux.list(educator.id) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createGetPlateauHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  plateaux: Pick<PlateauGateway, "get">,
  log: (error: unknown) => void,
): (request: Request, plateauId: string) => Promise<Response> {
  return async (request, plateauId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ plateau: await plateaux.get(educator.id, plateauId) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createCreatePlateauHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  plateaux: Pick<PlateauGateway, "create">,
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
      const plateau = await plateaux.create(educator.id, { name, dateLabel, date, result });
      return Response.json({ plateau }, { status: 201 });
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
export function createUpdatePlateauDetailsHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  plateaux: Pick<PlateauGateway, "updateDetails">,
  log: (error: unknown) => void,
): (request: Request, plateauId: string) => Promise<Response> {
  return async (request, plateauId) => {
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
        plateau: await plateaux.updateDetails(educator.id, plateauId, { date, location, description, result }),
      });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createRemovePlateauHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  plateaux: Pick<PlateauGateway, "remove">,
  log: (error: unknown) => void,
): (request: Request, plateauId: string) => Promise<Response> {
  return async (request, plateauId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      await plateaux.remove(educator.id, plateauId);
      return Response.json({ status: "ok" });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export async function createPlateauGateway(): Promise<{ gateway: PlateauGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, PrismaEducatorRepository, PrismaPlateauRepository, PlateauService } = await import(
    "@evolyfoot/database"
  );
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new PlateauService(new PrismaEducatorRepository(database.prisma), new PrismaPlateauRepository(database.prisma));

  function toSummary(plateau: Awaited<ReturnType<typeof service.create>>): PlateauSummary {
    return {
      id: plateau.id,
      name: plateau.name,
      dateLabel: plateau.dateLabel,
      date: plateau.date ? plateau.date.toISOString() : null,
      location: plateau.location,
      description: plateau.description,
      result: plateau.result,
      createdAt: plateau.createdAt.toISOString(),
    };
  }

  return {
    gateway: {
      async list(educatorId) {
        return (await service.list(educatorId)).map(toSummary);
      },
      async get(educatorId, plateauId) {
        const plateau = await service.getById(educatorId, plateauId);
        if (!plateau) {
          throw new PlateauNotFoundError();
        }
        return toSummary(plateau);
      },
      async create(educatorId, input) {
        return toSummary(await service.create(educatorId, { ...input, date: input.date ? new Date(input.date) : null }));
      },
      async updateDetails(educatorId, plateauId, input) {
        const { date, ...rest } = input;
        return toSummary(
          await service.updateDetails(educatorId, plateauId, {
            ...rest,
            ...(date !== undefined ? { date: date ? new Date(date) : null } : {}),
          }),
        );
      },
      remove(educatorId, plateauId) {
        return service.remove(educatorId, plateauId);
      },
    },
    disconnect: database.disconnect,
  };
}
