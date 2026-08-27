import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "./auth-service";
import { createDatabaseClient } from "./client";
import { InvalidCredentialsError } from "./errors";
import { PrismaEducatorRepository, PrismaSessionRepository } from "./prisma-repositories";

const testRun = `auth-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const sessionRepository = new PrismaSessionRepository(database.prisma);
const service = new AuthService(educatorRepository, sessionRepository);

function testEmail(suffix: string): string {
  return `${testRun}-${suffix}@example.test`;
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({
    where: { displayName: { startsWith: testRun } },
  });
}

describe("authentification éducateur", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("registers an educator, then logs in with the same credentials", async () => {
    const email = testEmail("register-login");
    await service.register({ email, password: "motdepasse1", displayName: `${testRun}-register-login` });

    const login = await service.login({ email, password: "motdepasse1" });

    expect(login.educator.email).toBe(email);
    await expect(database.prisma.educator.count({ where: { email } })).resolves.toBe(1);
  });

  it("rejects a second registration reusing the same normalized email", async () => {
    const email = testEmail("duplicate");
    await service.register({ email, password: "motdepasse1", displayName: `${testRun}-duplicate-1` });

    await expect(
      service.register({ email: ` ${email.toUpperCase()} `, password: "autremotdepasse", displayName: `${testRun}-duplicate-2` }),
    ).rejects.toThrow();
  });

  it("rejects a login with the wrong password", async () => {
    const email = testEmail("wrong-password");
    await service.register({ email, password: "motdepasse1", displayName: `${testRun}-wrong-password` });

    await expect(service.login({ email, password: "mauvaispasse" })).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("resolves the educator for a session token, and forgets it after logout", async () => {
    const email = testEmail("session-lifecycle");
    const { sessionToken, educator } = await service.register({
      email,
      password: "motdepasse1",
      displayName: `${testRun}-session-lifecycle`,
    });

    await expect(service.getEducatorForSession(sessionToken)).resolves.toMatchObject({ id: educator.id });

    await service.logout(sessionToken);

    await expect(service.getEducatorForSession(sessionToken)).resolves.toBeNull();
  });

  it("does not resolve a session token belonging to a deleted educator", async () => {
    const email = testEmail("cascade-delete");
    const { sessionToken, educator } = await service.register({
      email,
      password: "motdepasse1",
      displayName: `${testRun}-cascade-delete`,
    });

    await database.prisma.educator.delete({ where: { id: educator.id } });

    await expect(database.prisma.session.count({ where: { educatorId: educator.id } })).resolves.toBe(0);
    await expect(service.getEducatorForSession(sessionToken)).resolves.toBeNull();
  });

  it("issues independent sessions for each login", async () => {
    const email = testEmail("multi-session");
    await service.register({ email, password: "motdepasse1", displayName: `${testRun}-multi-session` });

    const first = await service.login({ email, password: "motdepasse1" });
    const second = await service.login({ email, password: "motdepasse1" });

    expect(first.sessionToken).not.toBe(second.sessionToken);
    await expect(service.getEducatorForSession(first.sessionToken)).resolves.not.toBeNull();
    await expect(service.getEducatorForSession(second.sessionToken)).resolves.not.toBeNull();

    await service.logout(first.sessionToken);

    await expect(service.getEducatorForSession(first.sessionToken)).resolves.toBeNull();
    await expect(service.getEducatorForSession(second.sessionToken)).resolves.not.toBeNull();
  });
});
