import { createEmptyPlayerEvaluationScores } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { PlayerNotFoundError, ValidationError } from "./errors";
import { PrismaEducatorRepository, PrismaPlayerEvaluationRepository, PrismaPlayerRepository } from "./prisma-repositories";
import { PlayerEvaluationService } from "./player-evaluation-service";

const testRun = `player-evaluation-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const playerRepository = new PrismaPlayerRepository(database.prisma);
const playerEvaluationRepository = new PrismaPlayerEvaluationRepository(database.prisma);
const service = new PlayerEvaluationService(educatorRepository, playerRepository, playerEvaluationRepository);

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

describe("PostgreSQL player evaluation persistence", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("creates then updates a single evaluation in place for the same player", async () => {
    const educator = await createEducator("upsert");
    const player = await playerRepository.create(educator.id, "Kylian");

    await service.save(educator.id, player.id, { ...createEmptyPlayerEvaluationScores(), technique: 4 });
    const updated = await service.save(educator.id, player.id, { ...createEmptyPlayerEvaluationScores(), technique: 5 });

    expect(updated.scores.technique).toBe(5);
    const all = await service.list(educator.id);
    expect(all).toHaveLength(1);
  });

  it("rejects a score outside the 1-5 range", async () => {
    const educator = await createEducator("invalid");
    const player = await playerRepository.create(educator.id, "Kylian");

    await expect(
      service.save(educator.id, player.id, { ...createEmptyPlayerEvaluationScores(), technique: 9 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects evaluating a player belonging to another educator", async () => {
    const owner = await createEducator("owner");
    const stranger = await createEducator("stranger");
    const player = await playerRepository.create(owner.id, "Kylian");

    await expect(
      service.save(stranger.id, player.id, createEmptyPlayerEvaluationScores()),
    ).rejects.toBeInstanceOf(PlayerNotFoundError);
  });

  it("cascades a test player deletion to its evaluation", async () => {
    const educator = await createEducator("cascade");
    const player = await playerRepository.create(educator.id, "Kylian");
    await service.save(educator.id, player.id, createEmptyPlayerEvaluationScores());

    await playerRepository.remove(player.id, educator.id);

    await expect(database.prisma.playerEvaluationRecord.count({ where: { playerId: player.id } })).resolves.toBe(0);
  });
});
