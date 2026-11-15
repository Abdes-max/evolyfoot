import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { SetupGuideService } from "./setup-guide-service";

const testRun = `setup-guide-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}
const database = createDatabaseClient(databaseUrl);
const service = new SetupGuideService(database.prisma);

async function cleanup() {
  await database.prisma.educator.deleteMany({ where: { email: { startsWith: testRun } } });
}

async function coach(suffix: string) {
  return database.prisma.educator.create({ data: { email: `${testRun}-${suffix}@example.test`, displayName: `${testRun}-${suffix}`, passwordHash: "x" } });
}

describe("guide de configuration", () => {
  beforeAll(cleanup);
  afterEach(cleanup);
  afterAll(() => database.disconnect());

  it("démarre à 0/7 puis coche chaque étape au bon moment, sans mélanger les éducateurs", async () => {
    const mine = await coach("a");
    const other = await coach("b");
    const initial = await service.get(mine.id, mine.id);
    expect(initial).toMatchObject({ done: 0, total: 7, dismissed: false });

    await database.prisma.player.create({ data: { educatorId: other.id, firstName: "Autre", lastName: "Joueur" } });
    expect((await service.get(mine.id, mine.id)).done).toBe(0);

    const match = await database.prisma.matchRecord.create({
      data: { educatorId: mine.id, opponent: "FC Test", dateLabel: "samedi", venue: "home", gameFormat: 11, status: "scheduled" },
    });
    const afterMatch = await service.get(mine.id, mine.id);
    expect(afterMatch.steps.find((step) => step.id === "match")?.done).toBe(true);
    expect(afterMatch.steps.find((step) => step.id === "result")?.done).toBe(false);

    await database.prisma.matchRecord.update({
      where: { id: match.id },
      data: { status: "played", goalsFor: 2, goalsAgainst: 1, playerStats: [{ playerId: "p1", playerName: "A B", goals: 1, assists: 0 }] },
    });
    expect((await service.get(mine.id, mine.id)).steps.find((step) => step.id === "result")?.done).toBe(true);
  });

  it("mémorise la fermeture sur le compte du coach et permet de la rouvrir", async () => {
    const mine = await coach("c");
    await service.setDismissed(mine.id, true);
    expect((await service.get(mine.id, mine.id)).dismissed).toBe(true);
    await service.setDismissed(mine.id, false);
    expect((await service.get(mine.id, mine.id)).dismissed).toBe(false);
  });
});
