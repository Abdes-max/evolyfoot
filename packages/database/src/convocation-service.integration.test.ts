import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { ConvocationService } from "./convocation-service";
import { EducatorNotFoundError, MatchNotFoundError, TrainingSessionNotFoundError, ValidationError } from "./errors";
import {
  PrismaEducatorRepository,
  PrismaMatchRepository,
  PrismaMessageRepository,
  PrismaPlayerRepository,
  PrismaTrainingSessionRepository,
} from "./prisma-repositories";
import type { TrainingSessionInput } from "./training-session-service";
import { TrainingSessionService } from "./training-session-service";
import { generateTrainingSession } from "@evolyfoot/domain";

const testRun = `convocation-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const playerRepository = new PrismaPlayerRepository(database.prisma);
const matchRepository = new PrismaMatchRepository(database.prisma);
const trainingSessionRepository = new PrismaTrainingSessionRepository(database.prisma);
const messageRepository = new PrismaMessageRepository(database.prisma);

const convocationService = new ConvocationService(educatorRepository, playerRepository, matchRepository, trainingSessionRepository, messageRepository);
const trainingSessionService = new TrainingSessionService(educatorRepository, trainingSessionRepository);

async function createCoach(suffix: string) {
  return educatorRepository.create({
    email: `${testRun}-${suffix}@example.test`,
    displayName: `${testRun}-${suffix}`,
    passwordHash: "coach-password-hash",
  });
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
}

const generated = generateTrainingSession({ week: 1, phase: "Découvrir", theme: "Récupérer rapidement", intention: "Test", observable: "Test" }, "U12", 14);
const sessionInput: TrainingSessionInput = {
  title: generated.title,
  ageGroup: generated.ageGroup,
  playerCount: generated.playerCount,
  theme: generated.theme,
  intention: generated.intention,
  blocks: generated.blocks.map((block) => ({ id: block.id, activityId: block.activity.id, durationMinutes: block.durationMinutes })),
  weekNumber: 1,
  slot: 0,
  meetingAt: new Date("2026-09-15T18:00:00.000Z"),
};

describe("ConvocationService", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("envoie un message de convocation à chaque joueur concerné par un match", async () => {
    const coach = await createCoach("match");
    const p1 = await playerRepository.create(coach.id, "Kylian");
    const p2 = await playerRepository.create(coach.id, "Nael");
    const outsider = await playerRepository.create(coach.id, "Pas concerné");
    const match = await matchRepository.create(coach.id, {
      opponent: "US Vallée",
      dateLabel: "Samedi 19 septembre",
      venue: "home",
      gameFormat: 8,
      formationId: "3-3-1",
      meetingTime: "14:30",
      location: "Stade Marius Requier",
      selectedPlayerIds: [p1.id, p2.id],
    });

    const result = await convocationService.sendForMatch(coach.id, match.id);

    expect(result).toMatchObject({ sentCount: 2, subject: "Convocation : match contre US Vallée", recipients: [] });
    expect((await matchRepository.findById(match.id, coach.id))?.convokedAt).toBeInstanceOf(Date);
    const p1Messages = await messageRepository.listByPlayer(coach.id, p1.id);
    expect(p1Messages).toHaveLength(1);
    expect(p1Messages[0]).toMatchObject({ authorRole: "coach", authorName: coach.displayName });
    expect(p1Messages[0]!.text).toContain("US Vallée");
    expect(p1Messages[0]!.text).toContain("14:30");
    expect(p1Messages[0]!.text).toContain("Stade Marius Requier");
    const outsiderMessages = await messageRepository.listByPlayer(coach.id, outsider.id);
    expect(outsiderMessages).toHaveLength(0);
  });

  it("rejette la convocation d'un match sans joueur concerné", async () => {
    const coach = await createCoach("empty-lineup");
    const match = await matchRepository.create(coach.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 8, formationId: "3-3-1" });

    await expect(convocationService.sendForMatch(coach.id, match.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejette la convocation d'un match d'un autre coach", async () => {
    const owner = await createCoach("owner");
    const stranger = await createCoach("stranger");
    const match = await matchRepository.create(owner.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 8, formationId: "3-3-1" });

    await expect(convocationService.sendForMatch(stranger.id, match.id)).rejects.toBeInstanceOf(MatchNotFoundError);
  });

  it("envoie un message de convocation à tout l'effectif pour une séance", async () => {
    const coach = await createCoach("session");
    const p1 = await playerRepository.create(coach.id, "Kylian");
    const p2 = await playerRepository.create(coach.id, "Nael");
    const session = await trainingSessionService.save(coach.id, sessionInput);
    await trainingSessionRepository.update(session.id, coach.id, { meetingAt: new Date("2026-09-16T18:00:00.000Z"), location: "Stade" });

    const result = await convocationService.sendForTrainingSession(coach.id, session.id);

    expect(result).toMatchObject({ sentCount: 2, recipients: [] });
    const p1Messages = await messageRepository.listByPlayer(coach.id, p1.id);
    expect(p1Messages).toHaveLength(1);
    expect(p1Messages[0]!.text).toContain(session.title);
    const p2Messages = await messageRepository.listByPlayer(coach.id, p2.id);
    expect(p2Messages).toHaveLength(1);
  });

  it("prévient aussi par e-mail l'adresse de la fiche et le compte lié, sans doublon", async () => {
    const coach = await createCoach("emails");
    const p1 = await playerRepository.create(coach.id, "Kylian");
    const p2 = await playerRepository.create(coach.id, "Nael");
    await playerRepository.create(coach.id, "Sans adresse");
    await playerRepository.update(p1.id, coach.id, { email: "parent.kylian@example.test" });
    await playerRepository.update(p2.id, coach.id, { email: "Tuteur.Nael@example.test" });
    await educatorRepository.create({
      email: "tuteur.nael@example.test",
      displayName: `${testRun}-tuteur`,
      passwordHash: "tutor-password-hash",
      role: "player",
      linkedPlayerId: p2.id,
    });
    const session = await trainingSessionService.save(coach.id, sessionInput);

    const result = await convocationService.sendForTrainingSession(coach.id, session.id);

    expect(result.sentCount).toBe(3);
    expect(result.recipients).toHaveLength(2);
    expect(result.recipients).toEqual(
      expect.arrayContaining([
        { email: "parent.kylian@example.test", name: "Kylian" },
        { email: "tuteur.nael@example.test", name: `${testRun}-tuteur` },
      ]),
    );
  });

  it("rejette la convocation d'une séance sans effectif", async () => {
    const coach = await createCoach("no-roster");
    const session = await trainingSessionService.save(coach.id, sessionInput);

    await expect(convocationService.sendForTrainingSession(coach.id, session.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejette un compte introuvable", async () => {
    // UUID syntaxiquement valide mais inexistant -- un id mal formé ferait échouer la requête
    // Postgres elle-même (colonne UUID) avant même d'atteindre la logique testée ici.
    await expect(convocationService.sendForMatch("00000000-0000-0000-0000-000000000000", "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(
      EducatorNotFoundError,
    );
  });
});
