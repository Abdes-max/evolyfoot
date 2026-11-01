import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "./auth-service";
import { createDatabaseClient } from "./client";
import { InvalidCredentialsError, ValidationError } from "./errors";
import { PasswordResetInvalidError, PasswordResetService } from "./password-reset-service";
import { PrismaEducatorRepository, PrismaPasswordResetRepository, PrismaSessionRepository } from "./prisma-repositories";

const testRun = `password-reset-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const resetRepository = new PrismaPasswordResetRepository(database.prisma);
const authService = new AuthService(educatorRepository, new PrismaSessionRepository(database.prisma));
const service = new PasswordResetService(educatorRepository, resetRepository);

const oldPassword = "ancien-mot-de-passe";
const newPassword = "nouveau-mot-de-passe";

async function register(suffix: string) {
  const email = `${testRun}-${suffix}@example.test`;
  const session = await authService.register({ email, password: oldPassword, displayName: `${testRun}-${suffix}` });
  return { email, session };
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
}

describe("PostgreSQL password reset", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("changes the password, closes every session and refuses a second use", async () => {
    const { email, session } = await register("flow");
    const created = await service.request(email);

    await service.reset(created!.token, newPassword);

    expect(await authService.getAccountForSession(session.sessionToken)).toBeNull();
    await expect(authService.login({ email, password: oldPassword })).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect((await authService.login({ email, password: newPassword })).educator.email).toBe(email);
    await expect(service.reset(created!.token, "encore-un-autre-mot")).rejects.toBeInstanceOf(PasswordResetInvalidError);
  });

  it("does nothing for an unknown or malformed address", async () => {
    expect(await service.request(`${testRun}-inconnu@example.test`)).toBeNull();
    expect(await service.request("pas-une-adresse")).toBeNull();
  });

  it("cancels the previous link when a new one is requested", async () => {
    const { email } = await register("replace");
    const first = await service.request(email);
    const second = await service.request(email);

    await expect(service.reset(first!.token, newPassword)).rejects.toBeInstanceOf(PasswordResetInvalidError);
    await service.reset(second!.token, newPassword);
  });

  it("limits requests per hour", async () => {
    const { email } = await register("limit");

    expect(await service.request(email)).not.toBeNull();
    expect(await service.request(email)).not.toBeNull();
    expect(await service.request(email)).not.toBeNull();
    expect(await service.request(email)).toBeNull();
  });

  it("refuses an expired link", async () => {
    const { email } = await register("expired");
    const created = await service.request(email);
    const later = new PasswordResetService(educatorRepository, resetRepository, () => new Date(Date.now() + 1000 * 60 * 61));

    await expect(later.reset(created!.token, newPassword)).rejects.toBeInstanceOf(PasswordResetInvalidError);
  });

  it("refuses a password that is too short and keeps the link usable", async () => {
    const { email } = await register("short");
    const created = await service.request(email);

    await expect(service.reset(created!.token, "court")).rejects.toBeInstanceOf(ValidationError);
    await service.reset(created!.token, newPassword);
  });
});
