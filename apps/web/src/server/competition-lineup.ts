import { EducatorNotFoundError, PlateauNotFoundError, TournamentNotFoundError, ValidationError, type CompetitionKind } from "@evolyfoot/database";
import type { CompetitionLineup } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";

export interface CompetitionLineupGateway {
  save(educatorId: string, kind: CompetitionKind, competitionId: string, lineup: unknown): Promise<CompetitionLineup>;
}

export async function createCompetitionLineupGateway(): Promise<{ gateway: CompetitionLineupGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, CompetitionLineupService, PrismaPlateauRepository, PrismaPlayerRepository, PrismaTournamentRepository } =
    await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new CompetitionLineupService(
    new PrismaPlayerRepository(database.prisma),
    new PrismaTournamentRepository(database.prisma),
    new PrismaPlateauRepository(database.prisma),
  );
  return {
    gateway: { save: (educatorId, kind, competitionId, lineup) => service.save(educatorId, kind, competitionId, lineup) },
    disconnect: database.disconnect,
  };
}

// PUT `{ lineup: { gameFormat, formationId, lineup, captainPlayerId, substitutePlayerIds } }` : composition d'un tournoi ou d'un plateau.
export function createSaveCompetitionLineupHandler(
  kind: CompetitionKind,
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  gateway: Pick<CompetitionLineupGateway, "save">,
  log: (error: unknown) => void,
): (request: Request, competitionId: string) => Promise<Response> {
  return async (request, competitionId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body: unknown = await request.json().catch(() => null);
    const lineup = typeof body === "object" && body !== null ? (body as { lineup?: unknown }).lineup : undefined;
    try {
      return Response.json({ lineup: await gateway.save(educator.id, kind, competitionId, lineup) });
    } catch (error) {
      if (error instanceof EducatorNotFoundError) return Response.json({ error: error.message }, { status: 401 });
      if (error instanceof TournamentNotFoundError || error instanceof PlateauNotFoundError) return Response.json({ error: error.message }, { status: 404 });
      if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}
