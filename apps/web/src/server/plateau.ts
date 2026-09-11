import { EducatorNotFoundError } from "@evolyfoot/database";
import type { PublicEducator } from "./auth";

export interface PlateauSummary {
  id: string;
  name: string;
  dateLabel: string;
  date: string | null;
  result: string | null;
  createdAt: string;
}

export interface PlateauGateway {
  list(educatorId: string): Promise<PlateauSummary[]>;
  create(educatorId: string, input: { name: string; dateLabel: string; date?: string | null; result?: string }): Promise<PlateauSummary>;
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
      result: plateau.result,
      createdAt: plateau.createdAt.toISOString(),
    };
  }

  return {
    gateway: {
      async list(educatorId) {
        return (await service.list(educatorId)).map(toSummary);
      },
      async create(educatorId, input) {
        return toSummary(await service.create(educatorId, { ...input, date: input.date ? new Date(input.date) : null }));
      },
      remove(educatorId, plateauId) {
        return service.remove(educatorId, plateauId);
      },
    },
    disconnect: database.disconnect,
  };
}
