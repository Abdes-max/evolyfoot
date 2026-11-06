import { generateTrainingSession } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { ConvocationService } from "./convocation-service";
import { ValidationError } from "./errors";
import { PlayerRsvpService } from "./player-rsvp-service";
import {
  PrismaEducatorRepository,
  PrismaMatchRepository,
  PrismaMessageRepository,
  PrismaPlayerRepository,
  PrismaTeamRepository,
  PrismaTrainingSessionRepository,
} from "./prisma-repositories";
import { PrismaTrainingConvocationRepository } from "./training-convocation-repository";
import { TrainingConvocationService } from "./training-convocation-service";
import { TrainingSessionService, type TrainingSessionInput } from "./training-session-service";

const testRun = `training-convocation-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const playerRepository = new PrismaPlayerRepository(database.prisma);
const trainingSessionRepository = new PrismaTrainingSessionRepository(database.prisma);
const messageRepository = new PrismaMessageRepository(database.prisma);
const teamRepository = new PrismaTeamRepository(database.prisma);
const convocationRepository = new PrismaTrainingConvocationRepository(database.prisma);
const now = new Date("2026-09-14T08:00:00.000Z");
const convocationService = new ConvocationService(
  educatorRepository,
  playerRepository,
  new PrismaMatchRepository(database.prisma),
  trainingSessionRepository,
  messageRepository,
  convocationRepository,
  () => now,
);
const service = new TrainingConvocationService(convocationRepository, convocationService);
const trainingSessionService = new TrainingSessionService(educatorRepository, trainingSessionRepository);
const rsvp = new PlayerRsvpService(educatorRepository, playerRepository, new PrismaMatchRepository(database.prisma), trainingSessionRepository);

const generated = generateTrainingSession({ week: 1, phase: "Découvrir", theme: "Récupérer rapidement", intention: "Test", observable: "Test" }, "U12", 14);
function sessionAt(meetingAt: Date, slot = 0): TrainingSessionInput {
  return {
    title: generated.title,
    ageGroup: generated.ageGroup,
    playerCount: generated.playerCount,
    theme: generated.theme,
    intention: generated.intention,
    blocks: generated.blocks.map((block) => ({ id: block.id, activityId: block.activity.id, durationMinutes: block.durationMinutes })),
    weekNumber: 1,
    slot,
    meetingAt,
  };
}

async function coachWithTeam(suffix: string) {
  const coach = await educatorRepository.create({ email: `${testRun}-${suffix}@example.test`, displayName: `${testRun}-${suffix}`, passwordHash: "hash" });
  await teamRepository.upsertForEducator(coach.id, {
    name: "FC Test",
    ageGroup: "U12",
    gameFormat: 8,
    playerCount: 12,
    sessionsPerWeek: 2,
    trainingDays: ["Mardi", "Jeudi"],
  });
  return coach;
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
}

describe("TrainingConvocationService", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("demande le réglage tant que l'éducateur ne l'a pas choisi, puis le garde", async () => {
    const coach = await coachWithTeam("settings");
    expect(await service.getSettings(coach.id)).toEqual({ leadDays: null, attendanceDefault: null, playerIds: null });
    await service.saveSettings(coach.id, { leadDays: 2, attendanceDefault: "present" });
    expect(await service.getSettings(coach.id)).toEqual({ leadDays: 2, attendanceDefault: "present", playerIds: null });
    await expect(service.saveSettings(coach.id, { leadDays: 5, attendanceDefault: "ask" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("envoie seulement les convocations arrivées à échéance, une seule fois, avec présence par défaut", async () => {
    const coach = await coachWithTeam("due");
    const player = await playerRepository.create(coach.id, "Kylian");
    await service.saveSettings(coach.id, { leadDays: 2, attendanceDefault: "present" });
    const soon = await trainingSessionService.save(coach.id, sessionAt(new Date("2026-09-15T18:00:00.000Z"), 0));
    const later = await trainingSessionService.save(coach.id, sessionAt(new Date("2026-09-20T18:00:00.000Z"), 1));

    const sent = (await service.sendDue(now)).filter((item) => item.educatorId === coach.id);
    expect(sent.map((item) => item.sessionId)).toEqual([soon.id]);
    expect((await service.sendDue(now)).filter((item) => item.educatorId === coach.id)).toEqual([]);

    const convoked = await trainingSessionRepository.findById(soon.id, coach.id);
    expect(convoked?.convokedAt).toEqual(now);
    expect(convoked?.attendance).toEqual([expect.objectContaining({ playerId: player.id, present: true, byDefault: true })]);
    expect((await trainingSessionRepository.findById(later.id, coach.id))?.convokedAt).toBeNull();
    expect(await messageRepository.listByPlayer(coach.id, player.id)).toHaveLength(1);
  });

  it("refuse une réponse tant que la séance n'est que programmée", async () => {
    const coach = await coachWithTeam("rsvp");
    const player = await playerRepository.create(coach.id, "Nael");
    const account = await educatorRepository.create({
      email: `${testRun}-player@example.test`,
      displayName: `${testRun}-player`,
      passwordHash: "hash",
      role: "player",
    });
    await database.prisma.educator.update({ where: { id: account.id }, data: { linkedPlayerId: player.id } });
    const session = await trainingSessionService.save(coach.id, sessionAt(new Date("2026-09-20T18:00:00.000Z")));

    await expect(rsvp.respondToTrainingSession(account.id, session.id, "present")).rejects.toBeInstanceOf(ValidationError);
    await convocationService.sendForTrainingSession(coach.id, session.id);
    await rsvp.respondToTrainingSession(account.id, session.id, "sick", "Grippe");
    expect((await trainingSessionRepository.findById(session.id, coach.id))?.attendance).toEqual([
      expect.objectContaining({ playerId: player.id, status: "sick", comment: "Grippe" }),
    ]);
  });
});
