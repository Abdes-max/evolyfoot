import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { EducatorNotFoundError } from "./errors";
import { PrismaEducatorRepository, PrismaSeasonProgramRepository } from "./prisma-repositories";
import { SeasonProgramService } from "./season-program-service";

const testRun = `season-program-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const service = new SeasonProgramService(educatorRepository, new PrismaSeasonProgramRepository(database.prisma));

async function createEducator(suffix: string) {
  return educatorRepository.create({ email: `${testRun}-${suffix}@example.test`, displayName: `${testRun}-${suffix}`, passwordHash: "test-hash" });
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
}

describe("PostgreSQL saison guidée", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("enregistre les priorités, garde la semaine de départ et les relit", async () => {
    const educator = await createEducator("coach");
    expect(await service.get(educator.id)).toBeNull();

    const first = await service.save(educator.id, ["Protéger son but", "Finir les actions"], new Date(Date.UTC(2026, 8, 7)));
    expect(first.priorities).toEqual(["Protéger son but", "Finir les actions"]);

    const updated = await service.save(educator.id, ["Conserver le ballon"], new Date(Date.UTC(2026, 10, 2)));
    expect(updated.priorities).toEqual(["Conserver le ballon"]);
    expect(updated.startDate.toISOString().slice(0, 10)).toBe("2026-09-07");
    expect((await service.get(educator.id))?.priorities).toEqual(["Conserver le ballon"]);
  });

  it("refuse des priorités invalides ou un éducateur inconnu", async () => {
    const educator = await createEducator("invalide");
    await expect(service.save(educator.id, [])).rejects.toThrow("Choisis un ou deux thèmes prioritaires.");
    await expect(service.save(educator.id, ["Inconnu"])).rejects.toThrow("Thème prioritaire inconnu.");
    await expect(service.save(crypto.randomUUID(), ["Finir les actions"])).rejects.toBeInstanceOf(EducatorNotFoundError);
  });
});
