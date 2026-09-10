import { formationSlots, generateTrainingSession } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { MatchService } from "./match-service";
import {
  PrismaEducatorRepository,
  PrismaMatchRepository,
  PrismaTournamentRepository,
  PrismaTrainingSessionRepository,
} from "./prisma-repositories";
import { StatsService } from "./stats-service";
import { TournamentService } from "./tournament-service";
import { TrainingSessionService } from "./training-session-service";

const testRun = `stats-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const trainingSessionRepository = new PrismaTrainingSessionRepository(database.prisma);
const matchRepository = new PrismaMatchRepository(database.prisma);
const tournamentRepository = new PrismaTournamentRepository(database.prisma);

const trainingSessionService = new TrainingSessionService(educatorRepository, trainingSessionRepository);
const matchService = new MatchService(educatorRepository, matchRepository);
const tournamentService = new TournamentService(educatorRepository, tournamentRepository);
const statsService = new StatsService(trainingSessionRepository, matchRepository, tournamentRepository);

const demoWeek = {
  week: 1,
  phase: "Découvrir" as const,
  theme: "Récupérer rapidement" as const,
  intention: "Provoquer des pertes de balle pour s’entraîner à réagir vite.",
  observable: "Les joueurs identifient le moment de la perte.",
};

function sessionInput(attendance?: Array<{ playerId: string; playerName: string; present: boolean }>) {
  const generated = generateTrainingSession(demoWeek, "U12", 14);
  return {
    title: generated.title,
    ageGroup: generated.ageGroup,
    playerCount: generated.playerCount,
    theme: generated.theme,
    intention: generated.intention,
    blocks: generated.blocks.map((block) => ({ id: block.id, activityId: block.activity.id, durationMinutes: block.durationMinutes })),
    ...(attendance ? { attendance } : {}),
  };
}

async function createEducator(suffix: string) {
  return educatorRepository.create({
    email: `${testRun}-${suffix}@example.test`,
    displayName: `${testRun}-${suffix}`,
    passwordHash: "test-hash",
  });
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
}

describe("PostgreSQL stats aggregation", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("compte séances, matchs et tournois pour l’éducateur demandeur uniquement", async () => {
    const owner = await createEducator("counts-owner");
    const stranger = await createEducator("counts-stranger");

    await trainingSessionService.save(owner.id, sessionInput());
    await trainingSessionService.save(owner.id, sessionInput());
    await matchService.create(owner.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 4 });
    await tournamentService.create(owner.id, { name: "Tournoi de printemps", dateLabel: "12 avril 2026" });
    await trainingSessionService.save(stranger.id, sessionInput());

    const stats = await statsService.get(owner.id);

    expect(stats.trainingCount).toBe(2);
    expect(stats.matchCount).toBe(1);
    expect(stats.matchesScheduled).toBe(1);
    expect(stats.matchesPlayed).toBe(0);
    expect(stats.tournamentCount).toBe(1);
  });

  it("agrège la présence aux séances, saisie à la validation", async () => {
    const educator = await createEducator("training-attendance");
    await trainingSessionService.save(
      educator.id,
      sessionInput([
        { playerId: "p1", playerName: "Lina", present: true },
        { playerId: "p2", playerName: "Noah", present: false },
      ]),
    );
    await trainingSessionService.save(
      educator.id,
      sessionInput([
        { playerId: "p1", playerName: "Lina", present: true },
        { playerId: "p2", playerName: "Noah", present: true },
      ]),
    );

    const stats = await statsService.get(educator.id);

    expect(stats.trainingAttendance).toEqual({ present: 3, absent: 1, total: 4, rate: 75 });
  });

  it("agrège la présence aux matchs, saisie en marquant le match joué", async () => {
    const educator = await createEducator("match-attendance");
    const match = await matchService.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 4 });
    const slots = formationSlots(4, match.formationId);
    const lineup = slots.map((slot, index) => ({ slotId: slot.id, playerId: `player-${index}`, playerName: `Joueur ${index}` }));
    await matchService.updateLineup(educator.id, match.id, { lineup, captainPlayerId: "player-0" });

    await matchService.markPlayed(educator.id, match.id, [
      { playerId: "player-0", playerName: "Joueur 0", present: true },
      { playerId: "player-1", playerName: "Joueur 1", present: true },
      { playerId: "player-2", playerName: "Joueur 2", present: false },
      { playerId: "player-3", playerName: "Joueur 3", present: true },
    ]);

    const stats = await statsService.get(educator.id);

    expect(stats.matchesPlayed).toBe(1);
    expect(stats.matchAttendance).toEqual({ present: 3, absent: 1, total: 4, rate: 75 });
  });

  it("ne compte aucune présence pour une séance ou un match sans présence saisie", async () => {
    const educator = await createEducator("no-attendance");
    await trainingSessionService.save(educator.id, sessionInput());
    await matchService.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 4 });

    const stats = await statsService.get(educator.id);

    expect(stats.trainingAttendance).toEqual({ present: 0, absent: 0, total: 0, rate: 0 });
    expect(stats.matchAttendance).toEqual({ present: 0, absent: 0, total: 0, rate: 0 });
  });
});
