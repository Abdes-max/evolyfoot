import { EducatorNotFoundError, PlateauNotFoundError, TournamentNotFoundError, ValidationError, type CompetitionKind } from "@evolyfoot/database";
import type { CompetitionGame } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";
import { databaseErrorResponse } from "./api-errors";

export interface CompetitionGamesGateway {
  save(educatorId: string, kind: CompetitionKind, competitionId: string, games: unknown): Promise<CompetitionGame[]>;
}

export async function createCompetitionGamesGateway(): Promise<{ gateway: CompetitionGamesGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, CompetitionGamesService, PrismaPlateauRepository, PrismaPlayerRepository, PrismaTournamentRepository } =
    await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new CompetitionGamesService(
    new PrismaPlayerRepository(database.prisma),
    new PrismaTournamentRepository(database.prisma),
    new PrismaPlateauRepository(database.prisma),
  );
  return {
    gateway: { save: (educatorId, kind, competitionId, games) => service.save(educatorId, kind, competitionId, games) },
    disconnect: database.disconnect,
  };
}

// PUT `{ games: [...] }` : remplace la liste des rencontres d'un tournoi ou d'un plateau (score, buteurs, passeurs).
export function createSaveCompetitionGamesHandler(
  kind: CompetitionKind,
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  gateway: Pick<CompetitionGamesGateway, "save">,
  log: (error: unknown) => void,
): (request: Request, competitionId: string) => Promise<Response> {
  return async (request, competitionId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body: unknown = await request.json().catch(() => null);
    const games = typeof body === "object" && body !== null ? (body as { games?: unknown }).games : undefined;
    try {
      return Response.json({ games: await gateway.save(educator.id, kind, competitionId, games) });
    } catch (error) {
      if (error instanceof EducatorNotFoundError) return Response.json({ error: error.message }, { status: 401 });
      if (error instanceof TournamentNotFoundError || error instanceof PlateauNotFoundError) return Response.json({ error: error.message }, { status: 404 });
      if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
      const databaseResponse = databaseErrorResponse(error, log);
      if (databaseResponse) {
        return databaseResponse;
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}
