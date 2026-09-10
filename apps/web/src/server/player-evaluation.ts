import { EducatorNotFoundError, PlayerNotFoundError } from "@evolyfoot/database";
import { playerEvaluationAspects } from "@evolyfoot/domain";
import type { PlayerEvaluationScores } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";

export interface PlayerEvaluationSummary {
  playerId: string;
  scores: PlayerEvaluationScores;
  updatedAt: string;
}

export interface PlayerEvaluationGateway {
  list(educatorId: string): Promise<PlayerEvaluationSummary[]>;
  save(educatorId: string, playerId: string, scores: PlayerEvaluationScores): Promise<PlayerEvaluationSummary>;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isScoresShaped(value: unknown): value is PlayerEvaluationScores {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return playerEvaluationAspects.every((aspect) => typeof record[aspect] === "number");
}

export function createListPlayerEvaluationsHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  evaluations: Pick<PlayerEvaluationGateway, "list">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ evaluations: await evaluations.list(educator.id) });
    } catch (error) {
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export function createSavePlayerEvaluationHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  evaluations: Pick<PlayerEvaluationGateway, "save">,
  log: (error: unknown) => void,
): (request: Request, playerId: string) => Promise<Response> {
  return async (request, playerId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await readJsonBody(request);
    if (!isScoresShaped(body?.scores)) {
      return Response.json({ error: "L’évaluation est incomplète." }, { status: 400 });
    }

    try {
      return Response.json({ evaluation: await evaluations.save(educator.id, playerId, body.scores) });
    } catch (error) {
      if (error instanceof EducatorNotFoundError) {
        return Response.json({ error: error.message }, { status: 401 });
      }
      if (error instanceof PlayerNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      if (error instanceof Error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export async function createPlayerEvaluationGateway(): Promise<{
  gateway: PlayerEvaluationGateway;
  disconnect: () => Promise<void>;
}> {
  const {
    createDatabaseClient,
    PlayerEvaluationService,
    PrismaEducatorRepository,
    PrismaPlayerEvaluationRepository,
    PrismaPlayerRepository,
  } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new PlayerEvaluationService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaPlayerRepository(database.prisma),
    new PrismaPlayerEvaluationRepository(database.prisma),
  );

  function toSummary(evaluation: Awaited<ReturnType<typeof service.save>>): PlayerEvaluationSummary {
    return {
      playerId: evaluation.playerId,
      scores: evaluation.scores,
      updatedAt: evaluation.updatedAt.toISOString(),
    };
  }

  return {
    gateway: {
      async list(educatorId) {
        const evaluations = await service.list(educatorId);
        return evaluations.map(toSummary);
      },
      async save(educatorId, playerId, scores) {
        return toSummary(await service.save(educatorId, playerId, scores));
      },
    },
    disconnect: database.disconnect,
  };
}
