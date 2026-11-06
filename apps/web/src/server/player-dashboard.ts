import { EducatorNotFoundError } from "@evolyfoot/database";
import type { PlayerDashboard } from "@evolyfoot/database";
import type { PublicAccount } from "./auth";

export interface PlayerDashboardGateway {
  get(playerAccountId: string): Promise<PlayerDashboard>;
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
    // Compte dont aucune demande n'est encore acceptée : rien à montrer, l'appli affiche l'attente
    // (enfants en attente lus sur /api/joueur/enfants).
    if (!account.linkedPlayerId) {
      return Response.json({ dashboard: null, waiting: true });
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
    PrismaTrainingConvocationRepository,
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
    new PrismaTrainingConvocationRepository(database.prisma),
  );

  return {
    gateway: {
      get: (playerAccountId) => service.get(playerAccountId),
    },
    disconnect: database.disconnect,
  };
}
