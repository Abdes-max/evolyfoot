import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { EducatorNotFoundError } from "./errors";
import { PrismaEducatorRepository, PrismaSeasonProgramRepository, PrismaTeamRepository, PrismaTrainingSessionRepository } from "./prisma-repositories";
import { SeasonProgramService } from "./season-program-service";

const testRun = `season-program-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const trainingSessionRepository = new PrismaTrainingSessionRepository(database.prisma);
const teamRepository = new PrismaTeamRepository(database.prisma);
const service = new SeasonProgramService(educatorRepository, new PrismaSeasonProgramRepository(database.prisma), trainingSessionRepository, teamRepository);

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

  it("enregistre les créneaux récurrents et les reporte sur les séances de la saison à venir", async () => {
    const educator = await createEducator("schedule");
    await teamRepository.upsertForEducator(educator.id, {
      name: "FC Test",
      ageGroup: "U12",
      gameFormat: 8,
      playerCount: 12,
      sessionsPerWeek: 2,
      trainingDays: ["Mercredi", "Lundi"],
    });
    const created = await service.save(educator.id, ["Protéger son but"], new Date(Date.UTC(2026, 8, 7)), [
      { day: "Lundi", time: "12:00", location: "Aix" },
      { day: "Mercredi", time: "16:00", location: "Marseille" },
    ]);
    expect(created.schedule).toEqual([
      { day: "Lundi", time: "12:00", location: "Aix" },
      { day: "Mercredi", time: "16:00", location: "Marseille" },
    ]);
    await expect(service.save(educator.id, ["Protéger son but"], undefined, [{ day: "Lundi", time: "9h" }])).rejects.toThrow("Heure");

    // Séance de la saison préparée le mercredi 16 septembre (créneau 1 = mercredi) à 18:00, Paris.
    const session = await trainingSessionRepository.create(educator.id, {
      title: "Séance",
      ageGroup: "U12",
      playerCount: 12,
      theme: "Protéger son but",
      intention: "Test",
      blocks: [],
      cycleNumber: 0,
      weekNumber: 2,
      slot: 1,
      meetingAt: new Date("2026-09-16T16:00:00.000Z"),
    });
    await service.saveSchedule(educator.id, [{ day: "Mercredi", time: "17:30", location: "Vitrolles" }], new Date("2026-09-10T00:00:00.000Z"));
    const moved = await trainingSessionRepository.findById(session.id, educator.id);
    expect(moved?.meetingAt?.toISOString()).toBe("2026-09-16T15:30:00.000Z");
    expect(moved?.location).toBe("Vitrolles");
    expect((await service.get(educator.id))?.schedule).toEqual([{ day: "Mercredi", time: "17:30", location: "Vitrolles" }]);
  });
});
