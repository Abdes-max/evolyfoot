import { afterAll, describe, expect, it } from "vitest";
import { AuthService } from "./auth-service";
import { createDatabaseClient } from "./client";
import {
  PrismaEducatorRepository,
  PrismaPlayerRepository,
  PrismaSessionRepository,
  PrismaStaffRepository,
  PrismaTeamRepository,
  PrismaTeamSpaceRepository,
} from "./prisma-repositories";
import { StaffService } from "./staff-service";
import { TeamSpaceService } from "./team-space-service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const testRun = `equipes-${crypto.randomUUID()}`;
const database = createDatabaseClient(databaseUrl);
const educators = new PrismaEducatorRepository(database.prisma);
const sessions = new PrismaSessionRepository(database.prisma);
const teams = new PrismaTeamRepository(database.prisma);
const players = new PrismaPlayerRepository(database.prisma);
const auth = new AuthService(educators, sessions);
const service = new TeamSpaceService(educators, new PrismaTeamSpaceRepository(database.prisma), teams, sessions);
const staff = new StaffService(educators, new PrismaStaffRepository(database.prisma), teams, auth);

const register = (suffix: string) => auth.register({ email: `${testRun}-${suffix}@example.test`, password: "mot-de-passe-long", displayName: "Coach" });

afterAll(async () => {
  await database.prisma.educator.deleteMany({ where: { email: { startsWith: testRun } } });
  await database.disconnect();
});

describe("plusieurs équipes sur PostgreSQL", () => {
  it("sépare l'effectif de chaque équipe et suit l'équipe choisie dans la session", async () => {
    const { educator: coach, sessionToken } = await register("a");
    await players.create(coach.id, "Kylian");

    const { id } = await service.create(coach, sessionToken);
    expect((await auth.getEducatorForSession(sessionToken))?.id).toBe(id);
    await players.create(id, "Nael");

    expect((await players.listByEducator(id)).map((player) => player.firstName)).toEqual(["Nael"]);
    expect((await players.listByEducator(coach.id)).map((player) => player.firstName)).toEqual(["Kylian"]);

    await service.activate(coach, sessionToken, coach.id);
    expect((await auth.getEducatorForSession(sessionToken))?.id).toBe(coach.id);
    expect((await service.list(coach, sessionToken)).map((team) => [team.primary, team.active])).toEqual([
      [true, true],
      [false, false],
    ]);
  });

  it("donne à chaque équipe son propre staff", async () => {
    const { educator: coach, sessionToken } = await register("b");
    const { id } = await service.create(coach, sessionToken);

    const { token } = await staff.invite(id);
    const assistant = await staff.join(token, { email: `${testRun}-b-adjoint@example.test`, password: "mot-de-passe-long", displayName: "Adjoint" });

    expect((await auth.getEducatorForSession(assistant.sessionToken))?.id).toBe(id);
    expect(await staff.list(coach.id)).toEqual([]);
    expect((await staff.list(id)).map((member) => member.id)).toEqual([assistant.educator.id]);
  });

  it("supprime une équipe avec ses joueurs, et toutes les équipes avec le compte", async () => {
    const { educator: coach, sessionToken } = await register("c");
    const first = await service.create(coach, sessionToken);
    const second = await service.create(coach, sessionToken);
    await players.create(first.id, "Léo");

    await service.remove(coach, sessionToken, first.id);
    expect(await educators.findById(first.id)).toBeNull();
    expect(await database.prisma.player.count({ where: { educatorId: first.id } })).toBe(0);

    await database.prisma.educator.delete({ where: { id: coach.id } });
    expect(await educators.findById(second.id)).toBeNull();
  });
});
