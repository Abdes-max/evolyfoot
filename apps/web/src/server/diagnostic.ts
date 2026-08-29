import { EducatorNotFoundError } from "@evolyfoot/database";
import type { DiagnosticScores } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";

export interface DiagnosticGateway {
  get(educatorId: string): Promise<DiagnosticScores | null>;
  save(educatorId: string, scores: DiagnosticScores): Promise<DiagnosticScores>;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isDiagnosticScoresShaped(
  value: Record<string, unknown> | null,
): value is Record<string, unknown> & DiagnosticScores {
  if (!value) {
    return false;
  }
  return (
    typeof value.availability === "number" &&
    typeof value.scanning === "number" &&
    typeof value.progression === "number" &&
    typeof value.reactionAfterLoss === "number"
  );
}

export function createGetDiagnosticHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  diagnostic: Pick<DiagnosticGateway, "get">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    try {
      const scores = await diagnostic.get(educator.id);
      return Response.json({ scores });
    } catch (error) {
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export function createSaveDiagnosticHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  diagnostic: Pick<DiagnosticGateway, "save">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await readJsonBody(request);
    if (!isDiagnosticScoresShaped(body)) {
      return Response.json({ error: "Le diagnostic est incomplet." }, { status: 400 });
    }

    try {
      const scores = await diagnostic.save(educator.id, body);
      return Response.json({ scores });
    } catch (error) {
      if (error instanceof EducatorNotFoundError) {
        return Response.json({ error: error.message }, { status: 401 });
      }
      if (error instanceof Error) {
        // La validation métier (summarizeDiagnostic) échoue avec une Error générique.
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export async function createDiagnosticGateway(): Promise<{
  gateway: DiagnosticGateway;
  disconnect: () => Promise<void>;
}> {
  const {
    createDatabaseClient,
    DiagnosticService,
    DiagnosticNotFoundError,
    PrismaEducatorRepository,
    PrismaDiagnosticRepository,
  } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new DiagnosticService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaDiagnosticRepository(database.prisma),
  );

  return {
    gateway: {
      async get(educatorId) {
        try {
          const diagnostic = await service.get(educatorId);
          return diagnostic.scores;
        } catch (error) {
          if (error instanceof DiagnosticNotFoundError) {
            return null;
          }
          throw error;
        }
      },
      async save(educatorId, scores) {
        const diagnostic = await service.save(educatorId, scores);
        return diagnostic.scores;
      },
    },
    disconnect: database.disconnect,
  };
}
