import { afterAll, describe, expect, it } from "vitest";
import { AuthService } from "./auth-service";
import { ClubService } from "./club-service";
import { createDatabaseClient } from "./client";
import {
  PrismaClubRepository,
  PrismaEducatorRepository,
  PrismaPersonalExerciseRepository,
  PrismaSessionRepository,
  PrismaTeamRepository,
  PrismaTeamSpaceRepository,
} from "./prisma-repositories";
import { TeamSpaceService } from "./team-space-service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const testRun = `club-${crypto.randomUUID()}`;
const database = createDatabaseClient(databaseUrl);
const educators = new PrismaEducatorRepository(database.prisma);
const sessions = new PrismaSessionRepository(database.prisma);
const auth = new AuthService(educators, sessions);
const exercises = new PrismaPersonalExerciseRepository(database.prisma);
const clubs = new ClubService(new PrismaClubRepository(database.prisma));
const teamSpaces = new TeamSpaceService(educators, new PrismaTeamSpaceRepository(database.prisma), new PrismaTeamRepository(database.prisma), sessions);

const register = (suffix: string, displayName: string) =>
  auth.register({ email: `${testRun}-${suffix}@example.test`, password: "mot-de-passe-long", displayName });
const exercise = (title: string) => ({
  kind: "main" as const,
  theme: "Conserver le ballon" as const,
  title,
  objective: "",
  organization: "",
  instruction: "",
  observable: "",
  photo: null,
});

afterAll(async () => {
  const members = await database.prisma.educator.findMany({ where: { email: { startsWith: testRun } }, select: { clubId: true } });
  await database.prisma.educator.deleteMany({ where: { email: { startsWith: testRun } } });
  await database.prisma.club.deleteMany({ where: { id: { in: members.flatMap((member) => (member.clubId ? [member.clubId] : [])) } } });
  await database.disconnect();
});

describe("club sur PostgreSQL", () => {
  it("partage les exercices des autres membres et de leurs équipes ajoutées", async () => {
    const { educator: alice, sessionToken } = await register("a", "Alice");
    const { educator: bruno } = await register("b", "Bruno");
    const { educator: outsider } = await register("c", "Hors club");
    await exercises.create(alice.id, exercise("Rondo d’Alice"));
    const space = await teamSpaces.create(alice, sessionToken);
    await exercises.create(space.id, exercise("Jeu des U9 d’Alice"));
    await exercises.create(bruno.id, exercise("Toro de Bruno"));
    await exercises.create(outsider.id, exercise("Hors club"));

    const { joinCode } = await clubs.create(alice.id, "US Exemple");
    const joined = await clubs.join(bruno.id, joinCode.toLowerCase());
    expect(joined.members.map((member) => member.displayName)).toEqual(["Alice", "Bruno"]);

    expect((await clubs.sharedExercises(bruno.id)).map((shared) => [shared.title, shared.authorName]).sort()).toEqual([
      ["Jeu des U9 d’Alice", "Alice"],
      ["Rondo d’Alice", "Alice"],
    ]);
    expect((await clubs.sharedExercises(alice.id)).map((shared) => shared.title)).toEqual(["Toro de Bruno"]);
    expect(await clubs.sharedExercises(outsider.id)).toEqual([]);
  });

  it("supprime le club quand le dernier membre part", async () => {
    const { educator } = await register("d", "Seul");
    const club = await clubs.create(educator.id, "Club éphémère");
    await clubs.leave(educator.id);
    expect(await clubs.get(educator.id)).toBeNull();
    expect(await database.prisma.club.count({ where: { id: club.id } })).toBe(0);
  });
});
