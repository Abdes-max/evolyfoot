import { createEmptyPlayerEvaluationScores } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { PlayerEvaluationNotFoundError, PlayerNotFoundError, ValidationError } from "./errors";
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

  it("keeps a dated history of several evaluations per player, newest first", async () => {
    const educator = await createEducator("history");
    const player = await playerRepository.create(educator.id, "Kylian");

    await service.add(educator.id, player.id, { ...createEmptyPlayerEvaluationScores(), technique: 4 });
    await service.add(educator.id, player.id, { ...createEmptyPlayerEvaluationScores(), technique: 8 });

    const history = await service.listByPlayer(educator.id, player.id);
    expect(history).toHaveLength(2);
    expect(history[0]!.scores.technique).toBe(8);
    expect(history[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(history[1]!.createdAt.getTime());
  });

  it("caps the history at ten evaluations per player", async () => {
    const educator = await createEducator("cap");
    const player = await playerRepository.create(educator.id, "Kylian");

    for (let index = 0; index < 10; index += 1) {
      await service.add(educator.id, player.id, createEmptyPlayerEvaluationScores());
    }
    await expect(service.add(educator.id, player.id, createEmptyPlayerEvaluationScores())).rejects.toBeInstanceOf(
      ValidationError,
    );

    const [oldest] = (await service.listByPlayer(educator.id, player.id)).slice(-1);
    await service.remove(educator.id, oldest!.id);
    await expect(service.add(educator.id, player.id, createEmptyPlayerEvaluationScores())).resolves.toMatchObject({
      playerId: player.id,
    });
  });

  it("rejects a score outside the 0-10 range", async () => {
    const educator = await createEducator("invalid");
    const player = await playerRepository.create(educator.id, "Kylian");

    await expect(
      service.add(educator.id, player.id, { ...createEmptyPlayerEvaluationScores(), technique: 11 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects evaluating a player belonging to another educator", async () => {
    const owner = await createEducator("owner");
    const stranger = await createEducator("stranger");
    const player = await playerRepository.create(owner.id, "Kylian");

    await expect(
      service.add(stranger.id, player.id, createEmptyPlayerEvaluationScores()),
    ).rejects.toBeInstanceOf(PlayerNotFoundError);
  });

  it("cascades a test player deletion to its evaluations", async () => {
    const educator = await createEducator("cascade");
    const player = await playerRepository.create(educator.id, "Kylian");
    await service.add(educator.id, player.id, createEmptyPlayerEvaluationScores());

    await playerRepository.remove(player.id, educator.id);

    await expect(database.prisma.playerEvaluationRecord.count({ where: { playerId: player.id } })).resolves.toBe(0);
  });

  it("updates the score and/or date of an existing evaluation", async () => {
    const educator = await createEducator("update");
    const player = await playerRepository.create(educator.id, "Kylian");
    const created = await service.add(educator.id, player.id, { ...createEmptyPlayerEvaluationScores(), technique: 4 });

    const scoreOnly = await service.update(educator.id, created.id, { scores: { ...created.scores, technique: 9 } });
    expect(scoreOnly.scores.technique).toBe(9);
    expect(scoreOnly.createdAt.getTime()).toBe(created.createdAt.getTime());

    const newDate = new Date("2026-01-15T00:00:00.000Z");
    const dateOnly = await service.update(educator.id, created.id, { date: newDate });
    expect(dateOnly.createdAt.getTime()).toBe(newDate.getTime());
    expect(dateOnly.scores.technique).toBe(9);
  });

  it("rejects updating with an out-of-range score", async () => {
    const educator = await createEducator("update-invalid");
    const player = await playerRepository.create(educator.id, "Kylian");
    const created = await service.add(educator.id, player.id, createEmptyPlayerEvaluationScores());

    await expect(
      service.update(educator.id, created.id, { scores: { ...created.scores, technique: 42 } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects updating an evaluation belonging to another educator", async () => {
    const owner = await createEducator("update-owner");
    const stranger = await createEducator("update-stranger");
    const player = await playerRepository.create(owner.id, "Kylian");
    const created = await service.add(owner.id, player.id, createEmptyPlayerEvaluationScores());

    await expect(
      service.update(stranger.id, created.id, { scores: created.scores }),
    ).rejects.toBeInstanceOf(PlayerEvaluationNotFoundError);
  });
});
