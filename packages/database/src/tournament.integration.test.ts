import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { ValidationError } from "./errors";
import { PrismaEducatorRepository, PrismaTournamentRepository } from "./prisma-repositories";
import { TournamentService } from "./tournament-service";

const testRun = `tournament-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const tournamentRepository = new PrismaTournamentRepository(database.prisma);
const service = new TournamentService(educatorRepository, tournamentRepository);

async function createEducator(suffix: string) {
  return educatorRepository.create({
    email: `${testRun}-${suffix}@example.test`,
    displayName: `${testRun}-${suffix}`,
    passwordHash: "test-hash",
  });
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
}

describe("PostgreSQL tournament persistence", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("creates and lists tournaments most recent first", async () => {
    const educator = await createEducator("list");
    await service.create(educator.id, { name: "Tournoi de printemps", dateLabel: "12 avril 2026" });
    await service.create(educator.id, { name: "Tournoi d’été", dateLabel: "3 juillet 2026", result: "Vainqueur" });

    const tournaments = await service.list(educator.id);

    expect(tournaments.map((tournament) => tournament.name)).toEqual(["Tournoi d’été", "Tournoi de printemps"]);
    expect(tournaments[0]!.result).toBe("Vainqueur");
    expect(tournaments[1]!.result).toBeNull();
  });

  it("rejects a tournament without a name", async () => {
    const educator = await createEducator("invalid");

    await expect(service.create(educator.id, { name: "  ", dateLabel: "12 avril 2026" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("removes a tournament only for its owning educator, silently no-ops otherwise", async () => {
    const owner = await createEducator("owner");
    const stranger = await createEducator("stranger");
    const tournament = await service.create(owner.id, { name: "Tournoi", dateLabel: "12 avril 2026" });

    await service.remove(stranger.id, tournament.id);
    await expect(service.list(owner.id)).resolves.toHaveLength(1);

    await service.remove(owner.id, tournament.id);
    await expect(service.list(owner.id)).resolves.toHaveLength(0);
  });

  it("cascades a test educator deletion to its tournaments", async () => {
    const educator = await createEducator("cascade");
    await service.create(educator.id, { name: "Tournoi", dateLabel: "12 avril 2026" });

    await database.prisma.educator.delete({ where: { id: educator.id } });

    await expect(database.prisma.tournamentRecord.count({ where: { educatorId: educator.id } })).resolves.toBe(0);
  });
});
