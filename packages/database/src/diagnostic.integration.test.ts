import type { DiagnosticScores } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { DiagnosticNotFoundError } from "./errors";
import { DiagnosticService } from "./diagnostic-service";
import { PrismaDiagnosticRepository, PrismaEducatorRepository } from "./prisma-repositories";

const testRun = `diagnostic-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const diagnosticRepository = new PrismaDiagnosticRepository(database.prisma);
const service = new DiagnosticService(educatorRepository, diagnosticRepository);

const validScores: DiagnosticScores = { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 };

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

describe("PostgreSQL diagnostic persistence", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("creates then idempotently updates the educator single diagnostic", async () => {
    const educator = await createEducator("upsert");
    const first = await service.save(educator.id, validScores);
    const second = await service.save(educator.id, { ...validScores, reactionAfterLoss: 4 });

    expect(second.id).toBe(first.id);
    expect(second.scores.reactionAfterLoss).toBe(4);
    await expect(database.prisma.diagnostic.count({ where: { educatorId: educator.id } })).resolves.toBe(1);
  });

  it("prevents educators from reading or overwriting each other diagnostics", async () => {
    const educatorA = await createEducator("owner-a");
    const educatorB = await createEducator("owner-b");
    await service.save(educatorA.id, validScores);

    await expect(service.get(educatorB.id)).rejects.toBeInstanceOf(DiagnosticNotFoundError);
    await service.save(educatorB.id, { ...validScores, scanning: 4 });

    await expect(service.get(educatorA.id)).resolves.toMatchObject({
      educatorId: educatorA.id,
      scores: { scanning: validScores.scanning },
    });
    await expect(service.get(educatorB.id)).resolves.toMatchObject({
      educatorId: educatorB.id,
      scores: { scanning: 4 },
    });
  });

  it("cascades a test educator deletion to its diagnostic", async () => {
    const educator = await createEducator("cascade");
    await service.save(educator.id, validScores);

    await database.prisma.educator.delete({ where: { id: educator.id } });

    await expect(database.prisma.diagnostic.count({ where: { educatorId: educator.id } })).resolves.toBe(0);
  });

  it("does not create a diagnostic for an invalid score", async () => {
    const educator = await createEducator("invalid-score");
    const invalidScores = { ...validScores, availability: 0 };

    await expect(service.save(educator.id, invalidScores)).rejects.toThrow(
      "Chaque critère doit être évalué de 1 à 4.",
    );
    await expect(database.prisma.diagnostic.count({ where: { educatorId: educator.id } })).resolves.toBe(0);
  });
});
