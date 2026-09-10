import { createObservationDraft, diagnosticCriteria, rateObservation } from "@evolyfoot/domain";
import type { ObservationDraft } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { ObservationService } from "./observation-service";
import { PrismaEducatorRepository, PrismaObservationRepository } from "./prisma-repositories";

const testRun = `observation-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const observationRepository = new PrismaObservationRepository(database.prisma);
const service = new ObservationService(educatorRepository, observationRepository);

function completeDraft(): ObservationDraft {
  let draft = createObservationDraft("match", "Observation de match", [{ id: "lina", name: "Lina" }]);
  for (const criterion of diagnosticCriteria) {
    draft = rateObservation(draft, criterion.id, "achieved");
  }
  return draft;
}

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

describe("PostgreSQL observation persistence", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("creates a new history record on every save", async () => {
    const educator = await createEducator("history");
    await service.save(educator.id, completeDraft());
    await service.save(educator.id, completeDraft());

    await expect(database.prisma.observationRecord.count({ where: { educatorId: educator.id } })).resolves.toBe(2);
  });

  it("round-trips the event type enum and the computed summary", async () => {
    const educator = await createEducator("round-trip");

    const saved = await service.save(educator.id, completeDraft());

    expect(saved.eventType).toBe("match");
    expect(saved.summary.trend).toBe("achieved");
    expect(saved.ratings).toHaveLength(diagnosticCriteria.length);
  });

  it("cascades a test educator deletion to its observations", async () => {
    const educator = await createEducator("cascade");
    await service.save(educator.id, completeDraft());

    await database.prisma.educator.delete({ where: { id: educator.id } });

    await expect(database.prisma.observationRecord.count({ where: { educatorId: educator.id } })).resolves.toBe(0);
  });

  it("does not create a record for an incomplete observation", async () => {
    const educator = await createEducator("invalid");
    const incomplete = createObservationDraft("training", "Observation de séance", []);

    await expect(service.save(educator.id, incomplete)).rejects.toThrow();
    await expect(database.prisma.observationRecord.count({ where: { educatorId: educator.id } })).resolves.toBe(0);
  });

  it("lists an educator's observations most recent first, excluding other educators'", async () => {
    const owner = await createEducator("list-owner");
    const other = await createEducator("list-other");
    const first = await service.save(owner.id, completeDraft());
    const second = await service.save(owner.id, completeDraft());
    await service.save(other.id, completeDraft());

    const observations = await service.list(owner.id);

    expect(observations.map((observation) => observation.id)).toEqual([second.id, first.id]);
  });

  it("gets a single observation only for its owning educator", async () => {
    const owner = await createEducator("get-owner");
    const other = await createEducator("get-other");
    const saved = await service.save(owner.id, completeDraft());

    await expect(service.get(owner.id, saved.id)).resolves.toMatchObject({ id: saved.id });
    await expect(service.get(other.id, saved.id)).rejects.toThrow("Observation introuvable.");
    await expect(service.get(owner.id, "00000000-0000-0000-0000-000000000000")).rejects.toThrow("Observation introuvable.");
  });
});
