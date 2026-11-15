import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "./auth-service";
import { createDatabaseClient } from "./client";
import { AccountSuspendedError, DuplicateEducatorEmailError, EducatorNotFoundError, InvalidCredentialsError, ValidationError } from "./errors";
import { PrismaEducatorRepository, PrismaSessionRepository } from "./prisma-repositories";
import { SuperAdminService } from "./super-admin-service";

const testRun = `super-admin-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const admin = new SuperAdminService(database.prisma);
const auth = new AuthService(new PrismaEducatorRepository(database.prisma), new PrismaSessionRepository(database.prisma));
const password = "un-mot-de-passe-long-1";

function email(suffix: string): string {
  return `${testRun}-${suffix}@example.test`;
}

async function cleanup(): Promise<void> {
  await database.prisma.superAdmin.deleteMany({ where: { email: { startsWith: testRun } } });
  await database.prisma.educator.deleteMany({ where: { email: { startsWith: testRun } } });
}

async function setup(suffix: string) {
  const account = await admin.createAccount({ email: email(`admin-${suffix}`), displayName: "Admin", password });
  const coach = await auth.register({ email: email(`coach-${suffix}`), password: "motdepasse1", displayName: `Coach ${suffix}` });
  return { account, coach: coach.educator };
}

describe("PostgreSQL super administrateur", () => {
  beforeAll(cleanup);
  afterEach(cleanup);
  afterAll(() => database.disconnect());

  it("crée un compte avec un mot de passe de 12 caractères minimum et refuse un doublon", async () => {
    await expect(admin.createAccount({ email: email("court"), displayName: "A", password: "court" })).rejects.toBeInstanceOf(ValidationError);
    await expect(admin.createAccount({ email: "pas-un-email", displayName: "A", password })).rejects.toBeInstanceOf(ValidationError);

    await admin.createAccount({ email: email("doublon"), displayName: "A", password });
    await expect(admin.createAccount({ email: email("doublon"), displayName: "B", password })).rejects.toBeInstanceOf(DuplicateEducatorEmailError);
  });

  it("connecte, reconnaît la session puis la ferme à la déconnexion", async () => {
    const { account } = await setup("login");

    await expect(admin.login({ email: account.email, password: "mauvais-mot-de-passe-1" })).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(admin.login({ email: email("inconnu"), password })).rejects.toBeInstanceOf(InvalidCredentialsError);

    const login = await admin.login({ email: account.email, password });
    expect((await admin.getBySession(login.sessionToken))?.email).toBe(account.email);
    expect(login.superAdmin.lastLoginAt).not.toBeNull();

    await admin.logout(login.sessionToken);
    expect(await admin.getBySession(login.sessionToken)).toBeNull();
  });

  it("n'accepte pas une session de superadmin expirée ni un jeton d'éducateur", async () => {
    const { account, coach } = await setup("expire");
    const login = await admin.login({ email: account.email, password });
    const later = new SuperAdminService(database.prisma, () => new Date(Date.now() + 9 * 60 * 60 * 1000));
    expect(await later.getBySession(login.sessionToken)).toBeNull();

    const educatorLogin = await auth.login({ email: coach.email, password: "motdepasse1" });
    expect(await admin.getBySession(educatorLogin.sessionToken)).toBeNull();
  });

  it("change le mot de passe en fermant les autres sessions", async () => {
    const { account } = await setup("password");
    const first = await admin.login({ email: account.email, password });
    const second = await admin.login({ email: account.email, password });

    await expect(
      admin.changePassword(account.id, { currentPassword: "faux-mot-de-passe-1", newPassword: "nouveau-mot-de-passe-1" }, first.sessionToken),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await admin.changePassword(account.id, { currentPassword: password, newPassword: "nouveau-mot-de-passe-1" }, first.sessionToken);

    expect(await admin.getBySession(first.sessionToken)).not.toBeNull();
    expect(await admin.getBySession(second.sessionToken)).toBeNull();
    await expect(admin.login({ email: account.email, password })).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect((await admin.login({ email: account.email, password: "nouveau-mot-de-passe-1" })).superAdmin.id).toBe(account.id);
  });

  it("suspend un éducateur : plus de connexion, sessions fermées, puis réactivation", async () => {
    const { account, coach } = await setup("suspend");
    const open = await auth.login({ email: coach.email, password: "motdepasse1" });
    expect(await auth.getEducatorForSession(open.sessionToken)).not.toBeNull();

    await admin.suspend(account.id, coach.id, "Abus signalé");

    await expect(auth.login({ email: coach.email, password: "motdepasse1" })).rejects.toBeInstanceOf(AccountSuspendedError);
    expect(await auth.getEducatorForSession(open.sessionToken)).toBeNull();
    expect((await admin.getEducator(coach.id)).suspended).toBe(true);

    await admin.reactivate(account.id, coach.id);
    expect((await auth.login({ email: coach.email, password: "motdepasse1" })).educator.id).toBe(coach.id);
  });

  it("note chaque action dans le journal d'audit, lisible avec filtre", async () => {
    const { account, coach } = await setup("audit");
    await admin.suspend(account.id, coach.id, "Test");
    await admin.reactivate(account.id, coach.id);
    await admin.setTest(account.id, coach.id, true);
    await admin.verifyEmail(account.id, coach.id);

    const all = await admin.listAudit({ search: coach.email });
    expect(all.items.map((entry) => entry.action).sort()).toEqual(["educator.mark-test", "educator.reactivate", "educator.suspend", "educator.verify-email"]);
    expect(all.items[0]?.superAdminEmail).toBe(account.email);
    const suspended = await admin.listAudit({ action: "educator.suspend", search: coach.email });
    expect(suspended.items).toHaveLength(1);
    expect(suspended.items[0]?.note).toBe("Test");
  });

  it("liste, filtre et lit le détail d'un éducateur, prolonge l'essai et marque un compte de test", async () => {
    const { account, coach } = await setup("list");

    const found = await admin.listEducators({ search: coach.email });
    expect(found.items.map((item) => item.email)).toEqual([coach.email]);
    expect(found.items[0]).toMatchObject({ access: "trial", suspended: false, isTest: false, emailVerified: false });

    const before = (await admin.getEducator(coach.id)).trialEndsAt;
    const trialEndsAt = await admin.extendTrial(account.id, coach.id, 30);
    expect(trialEndsAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    expect(before).toBeNull();
    await expect(admin.extendTrial(account.id, coach.id, 0)).rejects.toBeInstanceOf(ValidationError);

    await admin.setTest(account.id, coach.id, true);
    expect((await admin.listEducators({ search: coach.email, filter: "test" })).items).toHaveLength(1);
    expect((await admin.listEducators({ search: coach.email, filter: "suspended" })).items).toHaveLength(0);
    expect((await admin.getEducator(coach.id)).counts.players).toBe(0);
    await expect(admin.getEducator("00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(EducatorNotFoundError);
  });

  it("supprime un éducateur seulement avec son adresse e-mail en confirmation", async () => {
    const { account, coach } = await setup("delete");

    await expect(admin.deleteEducator(account.id, coach.id, "autre@example.test")).rejects.toBeInstanceOf(ValidationError);
    await admin.deleteEducator(account.id, coach.id, coach.email.toUpperCase());

    expect(await database.prisma.educator.findUnique({ where: { id: coach.id } })).toBeNull();
    expect((await admin.listAudit({ action: "educator.delete", search: coach.email })).items).toHaveLength(1);
  });

  it("ouvre une session « en tant que » courte, signalée, puis la ferme", async () => {
    const { account, coach } = await setup("impersonate");

    const started = await admin.startImpersonation(account.id, coach.id);
    expect((await auth.getEducatorForSession(started.sessionToken))?.id).toBe(coach.id);
    expect(started.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * 60 * 1000);
    expect(await admin.impersonationOf(started.sessionToken)).toEqual({ superAdminEmail: account.email });

    const normal = await auth.login({ email: coach.email, password: "motdepasse1" });
    expect(await admin.impersonationOf(normal.sessionToken)).toBeNull();
    expect(await admin.stopImpersonation(normal.sessionToken)).toBe(false);

    expect(await admin.stopImpersonation(started.sessionToken)).toBe(true);
    expect(await auth.getEducatorForSession(started.sessionToken)).toBeNull();
    const audit = await admin.listAudit({ search: coach.email });
    expect(audit.items.map((entry) => entry.action).sort()).toEqual(["impersonation.start", "impersonation.stop"]);
  });

  it("refuse de se connecter en tant qu'un compte suspendu ou inconnu", async () => {
    const { account, coach } = await setup("impersonate-refus");
    await admin.suspend(account.id, coach.id);

    await expect(admin.startImpersonation(account.id, coach.id)).rejects.toBeInstanceOf(ValidationError);
    await expect(admin.startImpersonation(account.id, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(EducatorNotFoundError);
  });

  it("donne les chiffres du tableau de bord sans compter les comptes de test comme réels", async () => {
    const { account, coach } = await setup("stats");
    const before = await admin.stats();
    await admin.setTest(account.id, coach.id, true);
    const after = await admin.stats();

    expect(after.educators.test).toBe(before.educators.test + 1);
    expect(after.educators.real).toBe(before.educators.real - 1);
    expect(after.access.trial).toBe(before.access.trial - 1);
  });
});
