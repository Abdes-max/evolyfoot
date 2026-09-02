import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { PlayerNotFoundError } from "./errors";
import { PrismaEducatorRepository, PrismaPlayerRepository } from "./prisma-repositories";
import { RosterService } from "./roster-service";

const testRun = `roster-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const playerRepository = new PrismaPlayerRepository(database.prisma);
const service = new RosterService(educatorRepository, playerRepository);

async function createEducator(suffix: string) {
  return educatorRepository.create({
    email: `${testRun}-${suffix}@example.test`,
    displayName: `${testRun}-${suffix}`,
    passwordHash: "test-hash",
  });
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({
    where: { displayName: { startsWith: testRun } },
  });
}

describe("PostgreSQL roster persistence", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("adds several players and lists them in creation order", async () => {
    const educator = await createEducator("list");
    await service.add(educator.id, "Kylian");
    await service.add(educator.id, "Ousmane");

    const roster = await service.list(educator.id);

    expect(roster.map((player) => player.name)).toEqual(["Kylian", "Ousmane"]);
  });

  it("renames a player belonging to the requesting educator", async () => {
    const educator = await createEducator("rename");
    const player = await service.add(educator.id, "Kylian");

    const renamed = await service.rename(educator.id, player.id, "Mbappé");

    expect(renamed.name).toBe("Mbappé");
  });

  it("rejects renaming or removing a player belonging to another educator", async () => {
    const owner = await createEducator("owner");
    const stranger = await createEducator("stranger");
    const player = await service.add(owner.id, "Kylian");

    await expect(service.rename(stranger.id, player.id, "Ousmane")).rejects.toBeInstanceOf(PlayerNotFoundError);
    await expect(service.remove(stranger.id, player.id)).rejects.toBeInstanceOf(PlayerNotFoundError);
    await expect(service.list(owner.id)).resolves.toHaveLength(1);
  });

  it("removes a player belonging to the requesting educator", async () => {
    const educator = await createEducator("remove");
    const player = await service.add(educator.id, "Kylian");

    await service.remove(educator.id, player.id);

    await expect(service.list(educator.id)).resolves.toHaveLength(0);
  });

  it("cascades a test educator deletion to its roster", async () => {
    const educator = await createEducator("cascade");
    await service.add(educator.id, "Kylian");

    await database.prisma.educator.delete({ where: { id: educator.id } });

    await expect(database.prisma.player.count({ where: { educatorId: educator.id } })).resolves.toBe(0);
  });
});
