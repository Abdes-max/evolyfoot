import { EducatorNotFoundError, PlayerEvaluationNotFoundError, PlayerNotFoundError, ValidationError } from "@evolyfoot/database";
import { playerEvaluationAspects } from "@evolyfoot/domain";
import type { PlayerEvaluationScores } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";

export interface PlayerEvaluationSummary {
  id: string;
  playerId: string;
  scores: PlayerEvaluationScores;
  createdAt: string;
}

export interface PlayerEvaluationGateway {
  list(educatorId: string): Promise<PlayerEvaluationSummary[]>;
  listByPlayer(educatorId: string, playerId: string): Promise<PlayerEvaluationSummary[]>;
  add(educatorId: string, playerId: string, scores: PlayerEvaluationScores): Promise<PlayerEvaluationSummary>;
  update(
    educatorId: string,
    evaluationId: string,
    input: { scores?: PlayerEvaluationScores; date?: string },
  ): Promise<PlayerEvaluationSummary>;
  remove(educatorId: string, evaluationId: string): Promise<void>;
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

function errorResponse(error: unknown, log: (error: unknown) => void): Response {
  if (error instanceof EducatorNotFoundError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof PlayerNotFoundError || error instanceof PlayerEvaluationNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ValidationError || error instanceof Error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

export function createListPlayerEvaluationsHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  evaluations: Pick<PlayerEvaluationGateway, "list" | "listByPlayer">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const playerId = new URL(request.url).searchParams.get("playerId");
    try {
      const list = playerId
        ? await evaluations.listByPlayer(educator.id, playerId)
        : await evaluations.list(educator.id);
      return Response.json({ evaluations: list });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createAddPlayerEvaluationHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  evaluations: Pick<PlayerEvaluationGateway, "add">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await readJsonBody(request);
    const playerId = typeof body?.playerId === "string" ? body.playerId : null;
    if (!playerId || !isScoresShaped(body?.scores)) {
      return Response.json({ error: "L’évaluation est incomplète." }, { status: 400 });
    }

    try {
      return Response.json({ evaluation: await evaluations.add(educator.id, playerId, body.scores) }, { status: 201 });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createUpdatePlayerEvaluationHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  evaluations: Pick<PlayerEvaluationGateway, "update">,
  log: (error: unknown) => void,
): (request: Request, evaluationId: string) => Promise<Response> {
  return async (request, evaluationId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await readJsonBody(request);
    const scores = body?.scores === undefined ? undefined : isScoresShaped(body.scores) ? body.scores : null;
    const date = body?.date === undefined ? undefined : typeof body.date === "string" ? body.date : null;
    if (scores === null || date === null || (scores === undefined && date === undefined)) {
      return Response.json({ error: "Rien à modifier." }, { status: 400 });
    }

    try {
      return Response.json({ evaluation: await evaluations.update(educator.id, evaluationId, { scores, date }) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createRemovePlayerEvaluationHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  evaluations: Pick<PlayerEvaluationGateway, "remove">,
  log: (error: unknown) => void,
): (request: Request, evaluationId: string) => Promise<Response> {
  return async (request, evaluationId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      await evaluations.remove(educator.id, evaluationId);
      return Response.json({ status: "ok" });
    } catch (error) {
      return errorResponse(error, log);
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

  function toSummary(evaluation: Awaited<ReturnType<typeof service.add>>): PlayerEvaluationSummary {
    return {
      id: evaluation.id,
      playerId: evaluation.playerId,
      scores: evaluation.scores,
      createdAt: evaluation.createdAt.toISOString(),
    };
  }

  return {
    gateway: {
      async list(educatorId) {
        return (await service.list(educatorId)).map(toSummary);
      },
      async listByPlayer(educatorId, playerId) {
        return (await service.listByPlayer(educatorId, playerId)).map(toSummary);
      },
      async add(educatorId, playerId, scores) {
        return toSummary(await service.add(educatorId, playerId, scores));
      },
      async update(educatorId, evaluationId, input) {
        return toSummary(
          await service.update(educatorId, evaluationId, {
            scores: input.scores,
            date: input.date === undefined ? undefined : new Date(input.date),
          }),
        );
      },
      remove(educatorId, evaluationId) {
        return service.remove(educatorId, evaluationId);
      },
    },
    disconnect: database.disconnect,
  };
}
