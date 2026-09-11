import { createEmptyPlayerEvaluationScores } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "./auth-service";
import { createDatabaseClient } from "./client";
import { InviteInvalidError, PlayerAccountExistsError } from "./player-invite-service";
import { PlayerInviteService } from "./player-invite-service";
import { PlayerDashboardService } from "./player-dashboard-service";
import { PlayerEvaluationService } from "./player-evaluation-service";
import { hashPassword } from "./password";
import {
  PrismaEducatorRepository,
  PrismaMatchRepository,
  PrismaPlateauRepository,
  PrismaPlayerEvaluationRepository,
  PrismaPlayerInviteRepository,
  PrismaPlayerRepository,
  PrismaSessionRepository,
  PrismaTeamRepository,
  PrismaTournamentRepository,
  PrismaTrainingSessionRepository,
} from "./prisma-repositories";

const testRun = `player-accounts-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const sessionRepository = new PrismaSessionRepository(database.prisma);
const playerRepository = new PrismaPlayerRepository(database.prisma);
const playerInviteRepository = new PrismaPlayerInviteRepository(database.prisma);
const teamRepository = new PrismaTeamRepository(database.prisma);
const trainingSessionRepository = new PrismaTrainingSessionRepository(database.prisma);
const matchRepository = new PrismaMatchRepository(database.prisma);
const playerEvaluationRepository = new PrismaPlayerEvaluationRepository(database.prisma);
const plateauRepository = new PrismaPlateauRepository(database.prisma);
const tournamentRepository = new PrismaTournamentRepository(database.prisma);

const authService = new AuthService(educatorRepository, sessionRepository);
const inviteService = new PlayerInviteService(
  educatorRepository,
  playerRepository,
  playerInviteRepository,
  teamRepository,
  authService,
);
const dashboardService = new PlayerDashboardService(
  educatorRepository,
  playerRepository,
  teamRepository,
  trainingSessionRepository,
  matchRepository,
  playerEvaluationRepository,
  plateauRepository,
  tournamentRepository,
);
const evaluationService = new PlayerEvaluationService(educatorRepository, playerRepository, playerEvaluationRepository);

async function createCoach(suffix: string) {
  return educatorRepository.create({
    email: `${testRun}-${suffix}@example.test`,
    displayName: `${testRun}-${suffix}`,
    passwordHash: await hashPassword("coach-password"),
  });
}

async function removeTestData(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
  await database.prisma.educator.deleteMany({ where: { email: { contains: testRun } } });
}

describe("PostgreSQL player accounts", () => {
  beforeAll(removeTestData);
  afterEach(removeTestData);
  afterAll(() => database.disconnect());

  it("invites a tutor, who creates a linked account and lands as a 'player' role", async () => {
    const coach = await createCoach("invite");
    const player = await playerRepository.create(coach.id, "Kylian");

    const { token } = await inviteService.create(coach.id, player.id);

    const preview = await inviteService.preview(token);
    expect(preview).toMatchObject({ playerName: "Kylian", coachName: coach.displayName });

    const session = await inviteService.consume(token, {
      email: `${testRun}-tutor@example.test`,
      password: "tutor-password",
      displayName: "Parent de Kylian",
    });
    expect(session.educator.role).toBe("player");
    expect(session.educator.linkedPlayerId).toBe(player.id);

    // Le jeton de session du compte joueur ne résout PAS comme éducateur.
    expect(await authService.getEducatorForSession(session.sessionToken)).toBeNull();
    expect(await authService.getPlayerAccountForSession(session.sessionToken)).not.toBeNull();
  });

  it("refuses a second invitation once a player already has a linked account", async () => {
    const coach = await createCoach("dup");
    const player = await playerRepository.create(coach.id, "Léo");
    const { token } = await inviteService.create(coach.id, player.id);
    await inviteService.consume(token, {
      email: `${testRun}-t2@example.test`,
      password: "tutor-password",
      displayName: "Tuteur",
    });

    await expect(inviteService.create(coach.id, player.id)).rejects.toBeInstanceOf(PlayerAccountExistsError);
  });

  it("rejects a consumed or unknown invite token", async () => {
    const coach = await createCoach("consumed");
    const player = await playerRepository.create(coach.id, "Noah");
    const { token } = await inviteService.create(coach.id, player.id);
    await inviteService.consume(token, {
      email: `${testRun}-t3@example.test`,
      password: "tutor-password",
      displayName: "Tuteur",
    });

    await expect(
      inviteService.consume(token, { email: `${testRun}-x@example.test`, password: "x-password", displayName: "X" }),
    ).rejects.toBeInstanceOf(InviteInvalidError);
    expect(await inviteService.preview("not-a-real-token")).toBeNull();
  });

  it("serves the player dashboard for the linked player only", async () => {
    const coach = await createCoach("dash");
    const player = await playerRepository.create(coach.id, "Ada");
    await evaluationService.add(coach.id, player.id, { ...createEmptyPlayerEvaluationScores(), technique: 8 });
    const { token } = await inviteService.create(coach.id, player.id);
    const session = await inviteService.consume(token, {
      email: `${testRun}-t4@example.test`,
      password: "tutor-password",
      displayName: "Tuteur",
    });
    const account = await authService.getPlayerAccountForSession(session.sessionToken);

    await plateauRepository.create(coach.id, { name: "Plateau de rentrée", dateLabel: "14 septembre 2026" });
    await tournamentRepository.create(coach.id, { name: "Tournoi U12", dateLabel: "21 septembre 2026" });

    const dashboard = await dashboardService.get(account!.id);
    expect(dashboard.player).toMatchObject({ id: player.id, name: "Ada" });
    expect(dashboard.evaluations).toHaveLength(1);
    expect(dashboard.evaluations[0]!.scores.technique).toBe(8);
    expect(dashboard.competitions).toHaveLength(2);
    expect(dashboard.competitions.map((competition) => competition.type).sort()).toEqual(["plateau", "tournoi"]);
    expect(dashboard.competitions.find((competition) => competition.type === "plateau")?.name).toBe("Plateau de rentrée");

    // Un compte coach n'a pas de tableau de bord joueur.
    await expect(dashboardService.get(coach.id)).rejects.toBeTruthy();
  });

  it("cascades a player deletion to its linked account", async () => {
    const coach = await createCoach("cascade");
    const player = await playerRepository.create(coach.id, "Zoé");
    const { token } = await inviteService.create(coach.id, player.id);
    const session = await inviteService.consume(token, {
      email: `${testRun}-t5@example.test`,
      password: "tutor-password",
      displayName: "Tuteur",
    });
    const account = await authService.getPlayerAccountForSession(session.sessionToken);

    await playerRepository.remove(player.id, coach.id);

    expect(await educatorRepository.findById(account!.id)).toBeNull();
  });
});
