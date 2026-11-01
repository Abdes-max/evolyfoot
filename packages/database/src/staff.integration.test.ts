import { afterAll, describe, expect, it } from "vitest";
import { AuthService } from "./auth-service";
import { createDatabaseClient } from "./client";
import { PrismaEducatorRepository, PrismaSessionRepository, PrismaStaffRepository, PrismaTeamRepository } from "./prisma-repositories";
import { StaffService } from "./staff-service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const testRun = `staff-${crypto.randomUUID()}`;
const database = createDatabaseClient(databaseUrl);
const educators = new PrismaEducatorRepository(database.prisma);
const staffRepository = new PrismaStaffRepository(database.prisma);
const auth = new AuthService(educators, new PrismaSessionRepository(database.prisma));
const service = new StaffService(educators, staffRepository, new PrismaTeamRepository(database.prisma), auth);

const email = (suffix: string) => `${testRun}-${suffix}@example.test`;
const owner = (suffix: string) => educators.create({ email: email(suffix), displayName: "Titulaire", passwordHash: "x" });
const join = (token: string, suffix: string) => service.join(token, { email: email(suffix), password: "mot-de-passe-long", displayName: "Adjoint" });

afterAll(async () => {
  await database.prisma.educator.deleteMany({ where: { email: { startsWith: testRun } } });
  await database.disconnect();
});

describe("staff sur PostgreSQL", () => {
  it("rattache l'adjoint à l'éducateur et lui donne accès à l'équipe", async () => {
    const coach = await owner("a");
    const { token } = await service.invite(coach.id);

    const session = await join(token, "a-adjoint");

    expect(session.educator).toMatchObject({ role: "assistant", ownerEducatorId: coach.id });
    expect((await auth.getEducatorForSession(session.sessionToken))?.id).toBe(coach.id);
    expect((await auth.getAccountForSession(session.sessionToken))?.id).toBe(session.educator.id);
    expect((await service.list(coach.id)).map((member) => member.id)).toEqual([session.educator.id]);
  });

  it("n'accepte qu'un seul compte pour deux envois simultanés d'un même lien", async () => {
    const coach = await owner("b");
    const { token } = await service.invite(coach.id);

    const results = await Promise.allSettled([join(token, "b-1"), join(token, "b-2")]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await service.list(coach.id)).toHaveLength(1);
  });

  it("empêche un autre éducateur de retirer un adjoint", async () => {
    const coach = await owner("c");
    const stranger = await owner("c-tiers");
    const { token } = await service.invite(coach.id);
    const session = await join(token, "c-adjoint");

    await expect(service.remove(stranger.id, session.educator.id)).rejects.toThrow();
    expect(await service.list(coach.id)).toHaveLength(1);
  });

  it("coupe l'accès de l'adjoint retiré", async () => {
    const coach = await owner("d");
    const { token } = await service.invite(coach.id);
    const session = await join(token, "d-adjoint");

    await service.remove(coach.id, session.educator.id);

    expect(await auth.getEducatorForSession(session.sessionToken)).toBeNull();
  });

  it("supprime les adjoints avec le compte de l'éducateur", async () => {
    const coach = await owner("e");
    const { token } = await service.invite(coach.id);
    const session = await join(token, "e-adjoint");

    await database.prisma.educator.delete({ where: { id: coach.id } });

    expect(await educators.findById(session.educator.id)).toBeNull();
  });
});
