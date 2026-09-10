import type { AttendanceSummary } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";

export interface TeamStatsSummary {
  trainingCount: number;
  matchCount: number;
  matchesPlayed: number;
  matchesScheduled: number;
  tournamentCount: number;
  trainingAttendance: AttendanceSummary;
  matchAttendance: AttendanceSummary;
}

export interface StatsGateway {
  get(educatorId: string): Promise<TeamStatsSummary>;
}

export function createGetStatsHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  stats: Pick<StatsGateway, "get">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ stats: await stats.get(educator.id) });
    } catch (error) {
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export async function createStatsGateway(): Promise<{ gateway: StatsGateway; disconnect: () => Promise<void> }> {
  const {
    createDatabaseClient,
    PrismaMatchRepository,
    PrismaTournamentRepository,
    PrismaTrainingSessionRepository,
    StatsService,
  } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new StatsService(
    new PrismaTrainingSessionRepository(database.prisma),
    new PrismaMatchRepository(database.prisma),
    new PrismaTournamentRepository(database.prisma),
  );

  return {
    gateway: {
      get(educatorId) {
        return service.get(educatorId);
      },
    },
    disconnect: database.disconnect,
  };
}
