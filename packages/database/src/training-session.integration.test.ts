import { generateTrainingSession } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { PrismaEducatorRepository, PrismaTrainingSessionRepository } from "./prisma-repositories";
import { TrainingSessionService, type TrainingSessionInput } from "./training-session-service";

const testRun = `training-session-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const trainingSessionRepository = new PrismaTrainingSessionRepository(database.prisma);
const service = new TrainingSessionService(educatorRepository, trainingSessionRepository);

const generated = generateTrainingSession(
  {
    week: 1,
    phase: "Découvrir",
    theme: "Récupérer rapidement",
    intention: "Provoquer des pertes de balle pour s’entraîner à réagir vite.",
    observable: "Les joueurs identifient le moment de la perte.",
  },
  "U12",
  14,
);
const validInput: TrainingSessionInput = {
  title: generated.title,
  ageGroup: generated.ageGroup,
  playerCount: generated.playerCount,
  theme: generated.theme,
  intention: generated.intention,
  blocks: generated.blocks.map((block) => ({
    id: block.id,
    activityId: block.activity.id,
    durationMinutes: block.durationMinutes,
  })),
  weekNumber: 1,
  slot: 0,
};

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

describe("PostgreSQL training session persistence", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("keeps one record per cycle slot, several per educator", async () => {
    const educator = await createEducator("history");
    await service.save(educator.id, { ...validInput, weekNumber: 1, slot: 0 });
    await service.save(educator.id, { ...validInput, weekNumber: 1, slot: 1 });

    await expect(
      database.prisma.trainingSessionRecord.count({ where: { educatorId: educator.id } }),
    ).resolves.toBe(2);
  });

  it("replaces (upserts) the session already stored for a cycle slot", async () => {
    const educator = await createEducator("upsert-slot");
    const first = await service.save(educator.id, { ...validInput, weekNumber: 2, slot: 0, title: "Séance A" });
    const second = await service.save(educator.id, { ...validInput, weekNumber: 2, slot: 0, title: "Séance B" });

    expect(second.id).toBe(first.id);
    expect(second.title).toBe("Séance B");
    await expect(
      database.prisma.trainingSessionRecord.count({ where: { educatorId: educator.id } }),
    ).resolves.toBe(1);
  });

  it("fetches a saved session by id, scoped to its educator", async () => {
    const educator = await createEducator("find-by-id");
    const other = await createEducator("find-by-id-other");
    const saved = await service.save(educator.id, validInput);

    await expect(service.getById(educator.id, saved.id)).resolves.toMatchObject({ id: saved.id });
    await expect(service.getById(other.id, saved.id)).resolves.toBeNull();
  });

  it("round-trips the theme enum and the block list", async () => {
    const educator = await createEducator("round-trip");

    const saved = await service.save(educator.id, validInput);

    expect(saved.theme).toBe(validInput.theme);
    expect(saved.blocks).toEqual(validInput.blocks);
  });

  it("cascades a test educator deletion to its training sessions", async () => {
    const educator = await createEducator("cascade");
    await service.save(educator.id, validInput);

    await database.prisma.educator.delete({ where: { id: educator.id } });

    await expect(
      database.prisma.trainingSessionRecord.count({ where: { educatorId: educator.id } }),
    ).resolves.toBe(0);
  });

  it("does not create a record for a session outside 60-90 minutes", async () => {
    const educator = await createEducator("invalid-duration");
    const tooShort: TrainingSessionInput = {
      ...validInput,
      blocks: validInput.blocks.map((block) => ({ ...block, durationMinutes: 5 })),
    };

    await expect(service.save(educator.id, tooShort)).rejects.toThrow(
      "La séance doit durer entre 60 et 90 minutes.",
    );
    await expect(
      database.prisma.trainingSessionRecord.count({ where: { educatorId: educator.id } }),
    ).resolves.toBe(0);
  });
});
