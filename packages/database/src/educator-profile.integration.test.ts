import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { EducatorProfileService } from "./educator-profile-service";
import { InvalidCredentialsError } from "./errors";
import { hashPassword, verifyPassword } from "./password";
import { PrismaEducatorRepository } from "./prisma-repositories";

const testRun = `educator-profile-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const repository = new PrismaEducatorRepository(database.prisma);
const service = new EducatorProfileService(repository);

async function createEducator(suffix: string) {
  return repository.create({
    email: `${testRun}-${suffix}@example.test`,
    displayName: `${testRun}-${suffix}`,
    passwordHash: await hashPassword("initial-password"),
  });
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
}

describe("PostgreSQL educator profile", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("round-trips the optional profile fields and clears one on empty string", async () => {
    const educator = await createEducator("round-trip");

    const updated = await service.update(educator.id, {
      club: "FC Horizon",
      country: "France",
      diploma: "CFF2",
      birthDate: "1986-05-11",
      seasonFormat: "Saison partagée (juil.–juin)",
    });
    expect(updated).toMatchObject({ club: "FC Horizon", birthDate: "1986-05-11", diploma: "CFF2" });

    const cleared = await service.update(educator.id, { club: "" });
    expect(cleared.club).toBeNull();
    expect(cleared.country).toBe("France");
  });

  it("changes the stored password hash only with the right current password", async () => {
    const educator = await createEducator("password");

    await expect(service.changePassword(educator.id, "not-the-password", "a-new-strong-password")).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );

    await service.changePassword(educator.id, "initial-password", "a-new-strong-password");
    const record = await database.prisma.educator.findUniqueOrThrow({ where: { id: educator.id } });
    expect(await verifyPassword("a-new-strong-password", record.passwordHash)).toBe(true);
    expect(await verifyPassword("initial-password", record.passwordHash)).toBe(false);
  });
});
