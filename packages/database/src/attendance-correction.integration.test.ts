import { generateTrainingSession } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { ValidationError } from "./errors";
import { MatchService } from "./match-service";
import { PlateauService } from "./plateau-service";
import {
  PrismaEducatorRepository,
  PrismaMatchRepository,
  PrismaPlateauRepository,
  PrismaPlayerRepository,
  PrismaTournamentRepository,
  PrismaTrainingSessionRepository,
} from "./prisma-repositories";
import { TournamentService } from "./tournament-service";
import { TrainingSessionService } from "./training-session-service";

const testRun = `attendance-correction-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const playerRepository = new PrismaPlayerRepository(database.prisma);
const sessionRepository = new PrismaTrainingSessionRepository(database.prisma);
const sessions = new TrainingSessionService(educatorRepository, sessionRepository, undefined, playerRepository);
const matches = new MatchService(educatorRepository, new PrismaMatchRepository(database.prisma), playerRepository);
const tournaments = new TournamentService(educatorRepository, new PrismaTournamentRepository(database.prisma), playerRepository);
const plateaux = new PlateauService(educatorRepository, new PrismaPlateauRepository(database.prisma), playerRepository);

const past = new Date("2026-01-10T18:00:00.000Z");
const future = new Date("2999-01-10T18:00:00.000Z");

async function setup(suffix: string) {
  const educator = await educatorRepository.create({
    email: `${testRun}-${suffix}@example.test`,
    displayName: `${testRun}-${suffix}`,
    passwordHash: "test-hash",
  });
  const yanis = await playerRepository.create(educator.id, "Yanis", "Martin");
  const lina = await playerRepository.create(educator.id, "Lina", "Dupont");
  return { educator, yanis, lina };
}

async function createSession(educatorId: string, meetingAt: Date) {
  const generated = generateTrainingSession(
    { week: 1, phase: "Découvrir", theme: "Récupérer rapidement", intention: "Réagir vite.", observable: "Les joueurs identifient la perte." },
    "U12",
    14,
  );
  return sessions.save(educatorId, {
    title: generated.title,
    ageGroup: generated.ageGroup,
    playerCount: generated.playerCount,
    theme: generated.theme,
    intention: generated.intention,
    blocks: generated.blocks.map((block) => ({ id: block.id, activityId: block.activity.id, durationMinutes: block.durationMinutes })),
    weekNumber: 1,
    slot: 0,
    meetingAt,
  });
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
}

describe("PostgreSQL attendance correction", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("valide les présences d’une séance passée, avec retard, et écrase la réponse du joueur", async () => {
    const { educator, yanis, lina } = await setup("session");
    const session = await createSession(educator.id, past);
    await database.prisma.trainingSessionRecord.update({
      where: { id: session.id },
      data: { attendance: [{ playerId: lina.id, playerName: "Lina Dupont", present: false, status: "absent" }] },
    });

    const saved = await sessions.setAttendance(educator.id, session.id, [
      { playerId: yanis.id, status: "late", comment: "ignoré" },
      { playerId: lina.id, status: "sick", comment: "Grippe" },
    ]);

    const byId = new Map(saved.attendance?.map((entry) => [entry.playerId, entry]));
    expect(byId.get(yanis.id)).toMatchObject({ status: "late", present: true, playerName: "Yanis Martin" });
    expect(byId.get(lina.id)).toMatchObject({ status: "sick", present: false, comment: "Grippe" });
  });

  it("refuse une séance pas encore passée, annulée ou un joueur inconnu", async () => {
    const { educator, yanis } = await setup("session-guards");
    const upcoming = await createSession(educator.id, future);
    await expect(sessions.setAttendance(educator.id, upcoming.id, [{ playerId: yanis.id, status: "present" }])).rejects.toThrow(/une fois la séance passée/);

    const finished = await createSession(educator.id, past);
    await expect(
      sessions.setAttendance(educator.id, finished.id, [{ playerId: "00000000-0000-0000-0000-000000000000", status: "present" }]),
    ).rejects.toBeInstanceOf(ValidationError);

    await database.prisma.trainingSessionRecord.update({ where: { id: finished.id }, data: { cancelledAt: new Date() } });
    await expect(sessions.setAttendance(educator.id, finished.id, [{ playerId: yanis.id, status: "present" }])).rejects.toThrow(/annulée/);
  });

  it("valide les présences d’un match joué seulement", async () => {
    const { educator, yanis, lina } = await setup("match");
    const match = await matches.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 8 });
    await expect(matches.setAttendance(educator.id, match.id, [{ playerId: yanis.id, status: "present" }])).rejects.toThrow(/une fois le match joué/);

    await database.prisma.matchRecord.update({ where: { id: match.id }, data: { status: "played" } });
    const saved = await matches.setAttendance(educator.id, match.id, [
      { playerId: yanis.id, status: "late" },
      { playerId: lina.id, status: "injured", comment: "Cheville" },
    ]);

    expect(saved.attendance?.map((entry) => [entry.playerName, entry.status, entry.present])).toEqual([
      ["Yanis Martin", "late", true],
      ["Lina Dupont", "injured", false],
    ]);
  });

  it("limite la correction aux joueurs concernés par l’événement", async () => {
    const { educator, yanis, lina } = await setup("selection");
    const match = await matches.create(educator.id, {
      opponent: "US Vallée",
      dateLabel: "Samedi",
      venue: "home",
      gameFormat: 8,
      selectedPlayerIds: [yanis.id],
    });
    await database.prisma.matchRecord.update({ where: { id: match.id }, data: { status: "played" } });

    await expect(matches.setAttendance(educator.id, match.id, [{ playerId: lina.id, status: "present" }])).rejects.toThrow(/ne fait pas partie/);
  });

  it("valide les présences d’un tournoi et d’un plateau terminés ou passés", async () => {
    const { educator, yanis } = await setup("competitions");
    const tournament = await tournaments.create(educator.id, { name: "Tournoi", dateLabel: "Demain", date: future });
    await expect(tournaments.setAttendance(educator.id, tournament.id, [{ playerId: yanis.id, status: "present" }])).rejects.toThrow(
      /une fois le tournoi terminé/,
    );
    await tournaments.updateDetails(educator.id, tournament.id, { finished: true });
    const savedTournament = await tournaments.setAttendance(educator.id, tournament.id, [{ playerId: yanis.id, status: "late" }]);
    expect(savedTournament.attendance?.[0]).toMatchObject({ status: "late", present: true });

    const plateau = await plateaux.create(educator.id, { name: "Plateau", dateLabel: "Hier", date: past });
    const savedPlateau = await plateaux.setAttendance(educator.id, plateau.id, [{ playerId: yanis.id, status: "absent", comment: "Famille" }]);
    expect(savedPlateau.attendance?.[0]).toMatchObject({ status: "absent", present: false, comment: "Famille" });
  });
});
