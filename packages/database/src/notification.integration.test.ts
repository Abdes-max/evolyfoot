import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { NotificationService } from "./notification-service";
import { PrismaEducatorRepository, PrismaNotificationRepository, PrismaPlayerRepository, PrismaPushDeviceRepository } from "./prisma-repositories";

const testRun = `notification-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const playerRepository = new PrismaPlayerRepository(database.prisma);
const devices = new PrismaPushDeviceRepository(database.prisma);
const service = new NotificationService(new PrismaNotificationRepository(database.prisma), devices);

function account(suffix: string, data: Record<string, unknown> = {}) {
  return database.prisma.educator.create({
    data: { email: `${testRun}-${suffix}@example.test`, displayName: `${testRun}-${suffix}`, passwordHash: "test-hash", ...data },
  });
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
}

describe("PostgreSQL notifications", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("prévient le coach derrière un espace d’équipe et ses adjoints, puis le compte du joueur", async () => {
    const coach = await account("coach");
    const assistant = await account("adjoint", { role: "assistant", ownerEducatorId: coach.id });
    const team = await account("equipe", { role: "team", ownerEducatorId: coach.id });
    const player = await playerRepository.create(team.id, "Lina");
    const tutor = await educatorRepository.create({
      email: `${testRun}-tuteur@example.test`,
      displayName: `${testRun}-tuteur`,
      passwordHash: "h",
      role: "player",
      linkedPlayerId: player.id,
    });

    await service.onMessage({ educatorId: team.id, playerId: player.id, authorRole: "player", authorName: "Lina", text: "Bonjour" });
    await service.onMessage({ educatorId: team.id, playerId: player.id, authorRole: "coach", authorName: "Coach", text: "Salut" });

    expect((await service.list(coach.id)).unreadMessages).toBe(1);
    expect((await service.list(assistant.id)).unreadMessages).toBe(1);
    expect((await service.list(team.id)).unreadCount).toBe(0);
    const tutorFeed = await service.list(tutor.id);
    expect(tutorFeed.notifications[0]).toMatchObject({ title: "Message de Coach", link: "/joueur/messages", threadPlayerId: player.id });

    await service.markRead(coach.id, { threadPlayerId: player.id });
    expect((await service.list(coach.id)).unreadCount).toBe(0);
    expect((await service.list(assistant.id)).unreadCount).toBe(1);
  });

  it("rattache un téléphone au dernier compte connecté", async () => {
    const first = await account("premier");
    const second = await account("second");
    const token = `ExponentPushToken[${testRun}]`;

    await service.registerDevice(first.id, token, "ios");
    await service.registerDevice(second.id, token, "ios");

    expect(await devices.tokensFor([first.id, second.id])).toEqual([{ educatorId: second.id, token }]);
    await service.unregisterDevice(second.id, token);
    expect(await devices.tokensFor([second.id])).toEqual([]);
  });
});
