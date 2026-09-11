import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { TournamentNotFoundError, ValidationError } from "./errors";
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

  it("fetches a tournament by id, scoped to its educator", async () => {
    const owner = await createEducator("find-by-id");
    const stranger = await createEducator("find-by-id-stranger");
    const tournament = await service.create(owner.id, { name: "Tournoi", dateLabel: "12 avril 2026" });

    await expect(service.getById(owner.id, tournament.id)).resolves.toMatchObject({ id: tournament.id });
    await expect(service.getById(stranger.id, tournament.id)).resolves.toBeNull();
  });

  it("modifie date/lieu/description/bilan indépendamment du nom et de la date d’affichage", async () => {
    const educator = await createEducator("details-update");
    const tournament = await service.create(educator.id, { name: "Tournoi", dateLabel: "12 avril 2026" });
    const date = new Date("2026-04-12T00:00:00.000Z");

    const updated = await service.updateDetails(educator.id, tournament.id, {
      date,
      location: "Stade Marius Requier",
      description: "Tournoi U12 sur herbe",
      result: "Vainqueur",
    });
    expect(updated.date).toEqual(date);
    expect(updated.location).toBe("Stade Marius Requier");
    expect(updated.description).toBe("Tournoi U12 sur herbe");
    expect(updated.result).toBe("Vainqueur");
    expect(updated.name).toBe("Tournoi");
  });

  it("rejette la modification des détails d’un tournoi introuvable ou appartenant à un autre éducateur", async () => {
    const owner = await createEducator("details-owner");
    const stranger = await createEducator("details-stranger");
    const tournament = await service.create(owner.id, { name: "Tournoi", dateLabel: "12 avril 2026" });

    await expect(
      service.updateDetails(stranger.id, tournament.id, { location: "Ailleurs" }),
    ).rejects.toBeInstanceOf(TournamentNotFoundError);
    await expect(
      service.updateDetails(owner.id, "00000000-0000-0000-0000-000000000000", { location: "Ailleurs" }),
    ).rejects.toBeInstanceOf(TournamentNotFoundError);
  });
});
