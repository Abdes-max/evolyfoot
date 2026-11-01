import { generateTrainingSession, type PersonalExerciseInput } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { ValidationError } from "./errors";
import { PersonalExerciseService } from "./personal-exercise-service";
import { PrismaEducatorRepository, PrismaPersonalExerciseRepository, PrismaTrainingSessionRepository } from "./prisma-repositories";
import { TrainingSessionService, type TrainingSessionInput } from "./training-session-service";

const testRun = `personal-exercise-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const personalExerciseRepository = new PrismaPersonalExerciseRepository(database.prisma);
const exerciseService = new PersonalExerciseService(educatorRepository, personalExerciseRepository);
const sessionService = new TrainingSessionService(educatorRepository, new PrismaTrainingSessionRepository(database.prisma), personalExerciseRepository);

const exerciseInput: PersonalExerciseInput = {
  kind: "main",
  theme: "Récupérer rapidement",
  title: "Mon pressing",
  objective: "Récupérer vite",
  organization: "Carré de 20m",
  instruction: "Presse à deux",
  observable: "La pression est collective",
  photo: null,
};

const generated = generateTrainingSession(
  { week: 1, phase: "Découvrir", theme: "Récupérer rapidement", intention: "Réagir vite.", observable: "Repère." },
  "U12",
  14,
);

function sessionWith(activityId: string): TrainingSessionInput {
  return {
    title: generated.title,
    ageGroup: generated.ageGroup,
    playerCount: generated.playerCount,
    theme: generated.theme,
    intention: generated.intention,
    blocks: generated.blocks.map((block, index) => ({
      id: block.id,
      activityId: index === 2 ? activityId : block.activity.id,
      durationMinutes: block.durationMinutes,
    })),
    weekNumber: 1,
    slot: 0,
    meetingAt: new Date("2026-11-10T18:00:00.000Z"),
  };
}

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

describe("PostgreSQL personal exercise persistence", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("lists and removes exercises for their owner only", async () => {
    const owner = await createEducator("owner");
    const other = await createEducator("other");
    const exercise = await exerciseService.add(owner.id, exerciseInput);

    expect(await exerciseService.list(other.id)).toEqual([]);
    await exerciseService.remove(other.id, exercise.id);
    expect(await exerciseService.list(owner.id)).toHaveLength(1);
    await exerciseService.remove(owner.id, exercise.id);
    expect(await exerciseService.list(owner.id)).toEqual([]);
  });

  it("accepts a session using one's own exercise and refuses someone else's", async () => {
    const owner = await createEducator("session-owner");
    const other = await createEducator("session-other");
    const exercise = await exerciseService.add(owner.id, exerciseInput);
    const activityId = `perso-${exercise.id}`;

    const saved = await sessionService.save(owner.id, sessionWith(activityId));

    expect(saved.blocks[2]?.activityId).toBe(activityId);
    await expect(sessionService.save(other.id, sessionWith(activityId))).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses an invalid sheet", async () => {
    const owner = await createEducator("invalid");

    await expect(exerciseService.add(owner.id, { ...exerciseInput, title: " " })).rejects.toBeInstanceOf(ValidationError);
  });
});
