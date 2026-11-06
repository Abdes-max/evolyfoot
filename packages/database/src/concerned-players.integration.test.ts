import { generateTrainingSession } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { CompetitionConvocationService } from "./competition-convocation-service";
import { ConvocationService } from "./convocation-service";
import { EducatorNotFoundError, ValidationError } from "./errors";
import { MatchService } from "./match-service";
import { PlayerDashboardService } from "./player-dashboard-service";
import { PlayerRsvpService } from "./player-rsvp-service";
import {
  PrismaEducatorRepository,
  PrismaMatchRepository,
  PrismaMessageRepository,
  PrismaPlateauRepository,
  PrismaPlayerEvaluationRepository,
  PrismaPlayerRepository,
  PrismaTeamRepository,
  PrismaTournamentRepository,
  PrismaTrainingSessionRepository,
} from "./prisma-repositories";
import { TournamentService } from "./tournament-service";
import { PrismaTrainingConvocationRepository } from "./training-convocation-repository";
import { TrainingConvocationService } from "./training-convocation-service";
import { TrainingSessionService } from "./training-session-service";

const testRun = `concerned-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const playerRepository = new PrismaPlayerRepository(database.prisma);
const matchRepository = new PrismaMatchRepository(database.prisma);
const trainingSessionRepository = new PrismaTrainingSessionRepository(database.prisma);
const tournamentRepository = new PrismaTournamentRepository(database.prisma);
const plateauRepository = new PrismaPlateauRepository(database.prisma);
const messageRepository = new PrismaMessageRepository(database.prisma);
const teamRepository = new PrismaTeamRepository(database.prisma);
const convocationRepository = new PrismaTrainingConvocationRepository(database.prisma);

const matchService = new MatchService(educatorRepository, matchRepository, playerRepository);
const tournamentService = new TournamentService(educatorRepository, tournamentRepository, playerRepository);
const convocationService = new ConvocationService(
  educatorRepository,
  playerRepository,
  matchRepository,
  trainingSessionRepository,
  messageRepository,
  convocationRepository,
);
const settingsService = new TrainingConvocationService(convocationRepository, convocationService, playerRepository);
const competitions = new CompetitionConvocationService(educatorRepository, playerRepository, tournamentRepository, plateauRepository, messageRepository);
const rsvp = new PlayerRsvpService(educatorRepository, playerRepository, matchRepository, trainingSessionRepository, convocationRepository);
const dashboard = new PlayerDashboardService(
  educatorRepository,
  playerRepository,
  teamRepository,
  trainingSessionRepository,
  matchRepository,
  new PrismaPlayerEvaluationRepository(database.prisma),
  plateauRepository,
  tournamentRepository,
  convocationRepository,
);
const trainingSessionService = new TrainingSessionService(educatorRepository, trainingSessionRepository);

const generated = generateTrainingSession({ week: 1, phase: "Découvrir", theme: "Récupérer rapidement", intention: "Test", observable: "Test" }, "U12", 14);

// Éducateur avec son équipe et deux joueurs, chacun suivi par un compte joueur.
async function setup(suffix: string) {
  const coach = await educatorRepository.create({ email: `${testRun}-${suffix}@example.test`, displayName: `${testRun}-${suffix}`, passwordHash: "hash" });
  await teamRepository.upsertForEducator(coach.id, {
    name: "FC Test",
    ageGroup: "U12",
    gameFormat: 8,
    playerCount: 12,
    sessionsPerWeek: 2,
    trainingDays: ["Mardi", "Jeudi"],
  });
  const accounts = [];
  for (const name of ["Kylian", "Nael"]) {
    const player = await playerRepository.create(coach.id, name);
    const account = await educatorRepository.create({
      email: `${testRun}-${suffix}-${name}@example.test`,
      displayName: `${testRun}-${suffix}-${name}`,
      passwordHash: "hash",
      role: "player",
    });
    await database.prisma.educator.update({ where: { id: account.id }, data: { linkedPlayerId: player.id } });
    accounts.push({ player, account });
  }
  return { coach, kylian: accounts[0]!, nael: accounts[1]! };
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
}

describe("joueurs concernés", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("ne montre un match, ne le convoque et n'accepte de réponse que des joueurs cochés", async () => {
    const { coach, kylian, nael } = await setup("match");
    const match = await matchService.create(coach.id, {
      opponent: "US Vallée",
      dateLabel: "Samedi",
      venue: "home",
      gameFormat: 8,
      selectedPlayerIds: [kylian.player.id],
    });
    expect(match.selectedPlayerIds).toEqual([kylian.player.id]);

    expect((await dashboard.get(kylian.account.id)).upcomingMatches.map((item) => item.id)).toEqual([match.id]);
    expect((await dashboard.get(nael.account.id)).upcomingMatches).toEqual([]);
    expect((await convocationService.sendForMatch(coach.id, match.id)).sentCount).toBe(1);
    await expect(rsvp.respondToMatch(nael.account.id, match.id, "present")).rejects.toBeInstanceOf(EducatorNotFoundError);
    await rsvp.respondToMatch(kylian.account.id, match.id, "present");

    // Tout cocher revient à tout l'effectif.
    const updated = await matchService.updateDetails(coach.id, match.id, { selectedPlayerIds: [kylian.player.id, nael.player.id] });
    expect(updated.selectedPlayerIds).toBeNull();
    await expect(matchService.updateDetails(coach.id, match.id, { selectedPlayerIds: [] })).rejects.toBeInstanceOf(ValidationError);
  });

  it("limite les entraînements aux joueurs choisis dans le réglage de l'équipe", async () => {
    const { coach, kylian, nael } = await setup("training");
    const settings = await settingsService.saveSettings(coach.id, { leadDays: null, attendanceDefault: "present", playerIds: [nael.player.id] });
    expect(settings.playerIds).toEqual([nael.player.id]);
    const session = await trainingSessionService.save(coach.id, {
      title: generated.title,
      ageGroup: generated.ageGroup,
      playerCount: generated.playerCount,
      theme: generated.theme,
      intention: generated.intention,
      blocks: generated.blocks.map((block) => ({ id: block.id, activityId: block.activity.id, durationMinutes: block.durationMinutes })),
      weekNumber: 1,
      slot: 0,
      meetingAt: new Date("2026-09-15T18:00:00.000Z"),
    });

    expect((await convocationService.sendForTrainingSession(coach.id, session.id)).sentCount).toBe(1);
    expect((await trainingSessionRepository.findById(session.id, coach.id))?.attendance).toEqual([
      expect.objectContaining({ playerId: nael.player.id, byDefault: true }),
    ]);
    expect((await dashboard.get(kylian.account.id)).trainingSessions).toEqual([]);
    expect((await dashboard.get(nael.account.id)).trainingSessions).toHaveLength(1);
    await expect(rsvp.respondToTrainingSession(kylian.account.id, session.id, "present")).rejects.toBeInstanceOf(EducatorNotFoundError);
  });

  it("convoque un tournoi à ses joueurs concernés et enregistre leurs réponses", async () => {
    const { coach, kylian, nael } = await setup("tournament");
    const tournament = await tournamentService.create(coach.id, { name: "Tournoi de Noël", dateLabel: "20 décembre", selectedPlayerIds: [nael.player.id] });
    await expect(tournamentService.create(coach.id, { name: "X", dateLabel: "Y", selectedPlayerIds: ["inconnu"] })).rejects.toBeInstanceOf(ValidationError);

    const before = (await dashboard.get(nael.account.id)).competitions;
    expect(before).toEqual([expect.objectContaining({ id: tournament.id, type: "tournoi", convoked: false, myStatus: null })]);
    expect((await dashboard.get(kylian.account.id)).competitions).toEqual([]);
    await expect(competitions.respond(nael.account.id, "tournament", tournament.id, "present")).rejects.toBeInstanceOf(ValidationError);

    const result = await competitions.send(coach.id, "tournament", tournament.id);
    expect(result).toMatchObject({ sentCount: 1, subject: "Convocation : tournoi « Tournoi de Noël »" });
    expect(await messageRepository.listByPlayer(coach.id, kylian.player.id)).toHaveLength(0);

    await competitions.respond(nael.account.id, "tournament", tournament.id, "absent", "Vacances");
    await expect(competitions.respond(kylian.account.id, "tournament", tournament.id, "present")).rejects.toBeInstanceOf(EducatorNotFoundError);
    const saved = await tournamentRepository.findById(tournament.id, coach.id);
    expect(saved?.convokedAt).toBeInstanceOf(Date);
    expect(saved?.attendance).toEqual([expect.objectContaining({ playerId: nael.player.id, status: "absent", comment: "Vacances" })]);
    expect((await dashboard.get(nael.account.id)).competitions[0]).toMatchObject({ convoked: true, myStatus: "absent" });
  });
});
