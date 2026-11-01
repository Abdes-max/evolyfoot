import { EducatorNotFoundError, ValidationError } from "@evolyfoot/database";
import type { PlayerDashboard, PlayerDashboardEvaluation } from "@evolyfoot/database";
import { playerEvaluationAspects } from "@evolyfoot/domain";
import type { PlayerEvaluationScores } from "@evolyfoot/domain";
import type { PublicAccount } from "./auth";

export interface PlayerDashboardGateway {
  get(playerAccountId: string): Promise<PlayerDashboard>;
  addSelfEvaluation(playerAccountId: string, scores: PlayerEvaluationScores): Promise<PlayerDashboardEvaluation>;
}

function isScoresShaped(value: unknown): value is PlayerEvaluationScores {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return playerEvaluationAspects.every((aspect) => typeof record[aspect] === "number");
}

export function createAddSelfEvaluationHandler(
  resolvePlayerAccount: (request: Request) => Promise<PublicAccount | null>,
  dashboard: Pick<PlayerDashboardGateway, "addSelfEvaluation">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const account = await resolvePlayerAccount(request);
    if (!account) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body: unknown = await request.json().catch(() => null);
    const scores = typeof body === "object" && body !== null ? (body as Record<string, unknown>).scores : null;
    if (!isScoresShaped(scores)) {
      return Response.json({ error: "L’auto-évaluation est incomplète." }, { status: 400 });
    }
    try {
      return Response.json({ evaluation: await dashboard.addSelfEvaluation(account.id, scores) }, { status: 201 });
    } catch (error) {
      if (error instanceof ValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      if (error instanceof EducatorNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export function createGetPlayerDashboardHandler(
  resolvePlayerAccount: (request: Request) => Promise<PublicAccount | null>,
  dashboard: Pick<PlayerDashboardGateway, "get">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const account = await resolvePlayerAccount(request);
    if (!account) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ dashboard: await dashboard.get(account.id) });
    } catch (error) {
      if (error instanceof EducatorNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export async function createPlayerDashboardGateway(): Promise<{
  gateway: PlayerDashboardGateway;
  disconnect: () => Promise<void>;
}> {
  const {
    createDatabaseClient,
    PlayerDashboardService,
    PrismaEducatorRepository,
    PrismaMatchRepository,
    PrismaPlateauRepository,
    PrismaPlayerEvaluationRepository,
    PrismaPlayerRepository,
    PrismaTeamRepository,
    PrismaTournamentRepository,
    PrismaTrainingSessionRepository,
  } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new PlayerDashboardService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaPlayerRepository(database.prisma),
    new PrismaTeamRepository(database.prisma),
    new PrismaTrainingSessionRepository(database.prisma),
    new PrismaMatchRepository(database.prisma),
    new PrismaPlayerEvaluationRepository(database.prisma),
    new PrismaPlateauRepository(database.prisma),
    new PrismaTournamentRepository(database.prisma),
  );

  return {
    gateway: {
      get: (playerAccountId) => service.get(playerAccountId),
      addSelfEvaluation: (playerAccountId, scores) => service.addSelfEvaluation(playerAccountId, scores),
    },
    disconnect: database.disconnect,
  };
}
