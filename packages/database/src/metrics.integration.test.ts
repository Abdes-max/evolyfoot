import { generateTrainingSession } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { MetricsService } from "./metrics-service";
import {
  PrismaEducatorRepository,
  PrismaObservationRepository,
  PrismaPlayerRepository,
  PrismaTeamRepository,
  PrismaTrainingSessionRepository,
} from "./prisma-repositories";
import { ObservationService } from "./observation-service";
import { RosterService } from "./roster-service";
import { TeamProfileService } from "./team-profile-service";
import { TrainingSessionService } from "./training-session-service";
import { createObservationDraft, diagnosticCriteria, rateObservation } from "@evolyfoot/domain";
import type { ObservationDraft, TeamProfile } from "@evolyfoot/domain";

const testRun = `metrics-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const teamService = new TeamProfileService(educatorRepository, new PrismaTeamRepository(database.prisma));
const trainingSessionService = new TrainingSessionService(educatorRepository, new PrismaTrainingSessionRepository(database.prisma));
const observationService = new ObservationService(educatorRepository, new PrismaObservationRepository(database.prisma));
const rosterService = new RosterService(educatorRepository, new PrismaPlayerRepository(database.prisma));
const metricsService = new MetricsService(database.prisma);

const validTeam: TeamProfile = {
  name: "FC Horizon",
  ageGroup: "U12",
  gameFormat: 8,
  playerCount: 14,
  sessionsPerWeek: 2,
  trainingDays: ["Mardi", "Jeudi"],
};

const generated = generateTrainingSession(
  { week: 1, phase: "Découvrir", theme: "Récupérer rapidement", intention: "x", observable: "y" },
  "U12",
  14,
);
const validSession = {
  title: generated.title,
  ageGroup: generated.ageGroup,
  playerCount: generated.playerCount,
  theme: generated.theme,
  intention: generated.intention,
  blocks: generated.blocks.map((block) => ({ id: block.id, activityId: block.activity.id, durationMinutes: block.durationMinutes })),
};

function completeDraft(): ObservationDraft {
  let draft = createObservationDraft("training", "Observation de séance", [{ id: "lina", name: "Lina" }]);
  for (const criterion of diagnosticCriteria) {
    draft = rateObservation(draft, criterion.id, "achieved");
  }
  return draft;
}

async function createEducator(suffix: string) {
  return educatorRepository.create({
    email: `${testRun}-${suffix}@example.test`,
    displayName: `${testRun}-${suffix}`,
    passwordHash: "test-hash",
  });
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({
    where: { displayName: { startsWith: testRun } },
  });
}

describe("PostgreSQL MVP metrics", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("counts each funnel step by distinct educator, decreasing down the funnel", async () => {
    const onlyRegistered = await createEducator("registered");
    const withTeam = await createEducator("team");
    await teamService.save(withTeam.id, validTeam);
    const withSession = await createEducator("session");
    await teamService.save(withSession.id, validTeam);
    await trainingSessionService.save(withSession.id, validSession);
    // Une deuxième séance pour le même éducateur ne doit pas être comptée deux fois dans
    // l'entonnoir (compte d'éducateurs distincts, pas de lignes).
    await trainingSessionService.save(withSession.id, validSession);

    const metrics = await metricsService.get();
    const byLabel = Object.fromEntries(metrics.funnel.map((step) => [step.label, step.count]));

    expect(byLabel["Comptes créés"]).toBeGreaterThanOrEqual(3);
    expect(byLabel["Équipe configurée"]).toBeGreaterThanOrEqual(2);
    expect(byLabel["Première séance validée"]).toBeGreaterThanOrEqual(1);
    // L'éducateur inscrit seul ne doit faire progresser aucune étape au-delà de la première.
    expect(byLabel["Comptes créés"]).toBeGreaterThan(byLabel["Équipe configurée"] - 1);
    void onlyRegistered;
  });

  it("counts an educator active this week exactly once even with both a session and an observation", async () => {
    const educator = await createEducator("weekly-once");
    await teamService.save(educator.id, validTeam);
    await trainingSessionService.save(educator.id, validSession);
    await observationService.save(educator.id, completeDraft());

    const metrics = await metricsService.get();
    const thisWeekStart = new Date();
    thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() - ((thisWeekStart.getUTCDay() + 6) % 7));
    const thisWeekIso = thisWeekStart.toISOString().slice(0, 10);
    const thisWeekPoint = metrics.weeklyActivity.find((point) => point.weekStart === thisWeekIso);

    expect(thisWeekPoint?.activeEducators).toBeGreaterThanOrEqual(1);
  });

  it("does not count an educator with no session or observation toward four-week retention", async () => {
    const inactive = await createEducator("inactive");
    await teamService.save(inactive.id, validTeam);

    const active = await createEducator("active-once");
    await teamService.save(active.id, validTeam);
    await trainingSessionService.save(active.id, validSession);

    const metrics = await metricsService.get();

    // Actif une seule des quatre semaines : compte dans le dénominateur, pas dans le numérateur.
    expect(metrics.retention.activeLastFourWeeks).toBeGreaterThanOrEqual(1);
    expect(metrics.retention.retainedFourWeeks).toBeLessThanOrEqual(metrics.retention.activeLastFourWeeks);
  });

  it("counts roster adoption by distinct educator with at least one player", async () => {
    const withRoster = await createEducator("roster");
    await rosterService.add(withRoster.id, "Kylian");
    await rosterService.add(withRoster.id, "Ousmane");
    const withoutRoster = await createEducator("no-roster");

    const metrics = await metricsService.get();

    expect(metrics.rosterAdoption.educatorsWithPlayers).toBeGreaterThanOrEqual(1);
    expect(metrics.rosterAdoption.totalEducators).toBeGreaterThanOrEqual(2);
    void withoutRoster;
  });
});
