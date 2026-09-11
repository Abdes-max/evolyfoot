import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { EmailVerificationService, VerificationInvalidError } from "./email-verification-service";
import { PrismaEducatorRepository, PrismaEmailVerificationRepository } from "./prisma-repositories";

const testRun = `email-verif-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const emailVerificationRepository = new PrismaEmailVerificationRepository(database.prisma);

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

describe("EmailVerificationService (PostgreSQL)", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("creates a token, then consuming it marks the account verified", async () => {
    const educator = await createEducator("consume");
    expect(educator.emailVerifiedAt ?? null).toBeNull();

    const service = new EmailVerificationService(educatorRepository, emailVerificationRepository);
    const created = await service.create(educator.id);
    expect(created.token).toBeTruthy();

    const verified = await service.consume(created.token);
    expect(verified.emailVerifiedAt).not.toBeNull();

    const reloaded = await educatorRepository.findById(educator.id);
    expect(reloaded?.emailVerifiedAt).not.toBeNull();
  });

  it("consuming the same token twice stays valid (idempotent)", async () => {
    const educator = await createEducator("twice");
    const service = new EmailVerificationService(educatorRepository, emailVerificationRepository);
    const created = await service.create(educator.id);

    await service.consume(created.token);
    const secondPass = await service.consume(created.token);
    expect(secondPass.emailVerifiedAt).not.toBeNull();
  });

  it("rejects an unknown token", async () => {
    const service = new EmailVerificationService(educatorRepository, emailVerificationRepository);
    await expect(service.consume("not-a-real-token")).rejects.toBeInstanceOf(VerificationInvalidError);
  });

  it("rejects an expired token", async () => {
    const educator = await createEducator("expired");
    let now = new Date("2026-01-01T00:00:00.000Z");
    const service = new EmailVerificationService(educatorRepository, emailVerificationRepository, () => now);
    const created = await service.create(educator.id);

    now = new Date("2026-01-10T00:00:00.000Z"); // bien après les 48h de validité
    await expect(service.consume(created.token)).rejects.toBeInstanceOf(VerificationInvalidError);
  });
});
