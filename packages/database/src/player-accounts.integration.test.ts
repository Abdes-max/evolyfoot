import { createEmptyPlayerEvaluationScores } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "./auth-service";
import { createDatabaseClient } from "./client";
import { PlayerNotFoundError } from "./errors";
import { PlayerChildrenService } from "./player-children-service";
import { InviteInvalidError } from "./player-invite-service";
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
const inviteService = new PlayerInviteService(educatorRepository, playerRepository, playerInviteRepository, teamRepository, authService);
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

  it("lets both parents follow the same child, and one parent follow several children", async () => {
    const children = new PlayerChildrenService(educatorRepository, educatorRepository, playerRepository, teamRepository, playerInviteRepository);
    const coach = await createCoach("family");
    const leo = await playerRepository.create(coach.id, "Léo");
    const ines = await playerRepository.create(coach.id, "Inès");

    // Premier parent : compte créé par l'invitation de Léo.
    const first = await inviteService.consume((await inviteService.create(coach.id, leo.id)).token, {
      email: `${testRun}-parent1@example.test`,
      password: "tutor-password",
      displayName: "Parent 1",
    });
    // Second parent : un autre compte sur le même enfant, désormais autorisé.
    const second = await inviteService.consume((await inviteService.create(coach.id, leo.id)).token, {
      email: `${testRun}-parent2@example.test`,
      password: "tutor-password",
      displayName: "Parent 2",
    });
    expect((await educatorRepository.findFollowers(leo.id)).map((account) => account.displayName).sort()).toEqual(["Parent 1", "Parent 2"]);

    // Le premier parent ajoute Inès avec son compte existant : elle devient l'enfant affiché.
    await children.attachInvite(first.educator.id, (await inviteService.create(coach.id, ines.id)).token);
    const list = await children.list(first.educator.id);
    expect(list.map((child) => [child.name, child.displayed])).toEqual([
      ["Léo", false],
      ["Inès", true],
    ]);

    await children.select(first.educator.id, leo.id);
    expect((await children.list(first.educator.id)).find((child) => child.displayed)?.name).toBe("Léo");
    // Le second parent ne suit pas Inès : il ne peut pas la choisir.
    await expect(children.select(second.educator.id, ines.id)).rejects.toBeInstanceOf(PlayerNotFoundError);
  });

  it("generates a new link on each request, every link staying valid once", async () => {
    const coach = await createCoach("again");
    const player = await playerRepository.create(coach.id, "Lou");
    const first = await inviteService.create(coach.id, player.id);
    const second = await inviteService.create(coach.id, player.id);

    expect(second.token).not.toBe(first.token);
    expect(await inviteService.preview(first.token)).not.toBeNull();
    expect(await inviteService.preview(second.token)).not.toBeNull();
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

    await expect(inviteService.consume(token, { email: `${testRun}-x@example.test`, password: "x-password", displayName: "X" })).rejects.toBeInstanceOf(
      InviteInvalidError,
    );
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
