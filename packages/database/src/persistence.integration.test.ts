import type { TeamProfile } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { DuplicateEducatorEmailError, TeamNotFoundError } from "./errors";
import { PrismaEducatorRepository, PrismaTeamRepository } from "./prisma-repositories";
import { TeamProfileService } from "./team-profile-service";

const testRun = `persistence-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const teamRepository = new PrismaTeamRepository(database.prisma);
const service = new TeamProfileService(educatorRepository, teamRepository);

const validProfile: TeamProfile = {
  name: "FC Horizon",
  ageGroup: "U12",
  playerCount: 14,
  sessionsPerWeek: 2,
  trainingDays: ["Mardi", "Jeudi"],
};

async function createEducator(suffix: string, email = `${testRun}-${suffix}@example.test`) {
  return educatorRepository.create({
    email,
    displayName: `${testRun}-${suffix}`,
    passwordHash: "test-hash",
  });
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({
    where: { displayName: { startsWith: testRun } },
  });
}

describe("PostgreSQL persistence", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("rejects emails that collide after normalization", async () => {
    await createEducator("normalized-first", "Coach@Example.fr");

    await expect(
      createEducator("normalized-second", " coach@example.fr "),
    ).rejects.toBeInstanceOf(DuplicateEducatorEmailError);
  });

  it("creates then idempotently updates the educator single team", async () => {
    const educator = await createEducator("upsert");
    const first = await service.save(educator.id, validProfile);
    const second = await service.save(educator.id, { ...validProfile, name: "FC Horizon Nord" });

    expect(second.id).toBe(first.id);
    expect(second.profile.name).toBe("FC Horizon Nord");
    await expect(database.prisma.team.count({ where: { educatorId: educator.id } })).resolves.toBe(1);
  });

  it("prevents educators from reading or overwriting each other teams", async () => {
    const educatorA = await createEducator("owner-a");
    const educatorB = await createEducator("owner-b");
    await service.save(educatorA.id, validProfile);

    await expect(service.get(educatorB.id)).rejects.toBeInstanceOf(TeamNotFoundError);
    await service.save(educatorB.id, { ...validProfile, name: "AS Rivière" });

    await expect(service.get(educatorA.id)).resolves.toMatchObject({
      educatorId: educatorA.id,
      profile: { name: "FC Horizon" },
    });
    await expect(service.get(educatorB.id)).resolves.toMatchObject({
      educatorId: educatorB.id,
      profile: { name: "AS Rivière" },
    });
  });

  it("round-trips French training days and the age group", async () => {
    const educator = await createEducator("round-trip");
    const profile: TeamProfile = {
      ...validProfile,
      ageGroup: "U13",
      trainingDays: ["Lundi", "Vendredi"],
    };

    await service.save(educator.id, profile);

    await expect(service.get(educator.id)).resolves.toMatchObject({
      profile: { ageGroup: "U13", trainingDays: ["Lundi", "Vendredi"] },
    });
  });

  it("cascades a test educator deletion to its team", async () => {
    const educator = await createEducator("cascade");
    await service.save(educator.id, validProfile);

    await database.prisma.educator.delete({ where: { id: educator.id } });

    await expect(database.prisma.team.count({ where: { educatorId: educator.id } })).resolves.toBe(0);
  });

  it("does not create a team for an invalid profile", async () => {
    const educator = await createEducator("invalid-profile");
    const invalidProfile = { ...validProfile, sessionsPerWeek: 3 };

    await expect(service.save(educator.id, invalidProfile)).rejects.toThrow("Le profil d’équipe est incomplet.");
    await expect(database.prisma.team.count({ where: { educatorId: educator.id } })).resolves.toBe(0);
  });
});
