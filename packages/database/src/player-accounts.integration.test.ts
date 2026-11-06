import { createEmptyPlayerEvaluationScores } from "@evolyfoot/domain";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "./auth-service";
import { createDatabaseClient } from "./client";
import { PlayerNotFoundError } from "./errors";
import { PlayerChildrenService } from "./player-children-service";
import { InviteInvalidError } from "./player-invite-service";
import { PlayerInviteService } from "./player-invite-service";
import { TutorService } from "./tutor-service";
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
const inviteService = new PlayerInviteService(educatorRepository, playerRepository, playerInviteRepository, teamRepository, authService, educatorRepository);
const tutorService = new TutorService(educatorRepository, playerRepository, educatorRepository);

// L'éducateur accepte les demandes de suivi faites par le lien d'invitation.
async function acceptRequests(coachId: string, playerId: string): Promise<void> {
  for (const request of (await tutorService.list(coachId, playerId)).requests) {
    await tutorService.answer(coachId, playerId, request.id, true);
  }
}
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
    // Aucun accès à l'enfant avant l'accord de l'éducateur.
    expect(session.educator.linkedPlayerId).toBeNull();
    await expect(dashboardService.get(session.educator.id)).rejects.toBeTruthy();
    await acceptRequests(coach.id, player.id);
    expect((await educatorRepository.findById(session.educator.id))?.linkedPlayerId).toBe(player.id);

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
    // Second parent : un autre compte sur le même enfant, avec le même lien.
    const second = await inviteService.consume((await inviteService.create(coach.id, leo.id)).token, {
      email: `${testRun}-parent2@example.test`,
      password: "tutor-password",
      displayName: "Parent 2",
    });
    await acceptRequests(coach.id, leo.id);
    expect((await educatorRepository.findFollowers(leo.id)).map((account) => account.displayName).sort()).toEqual(["Parent 1", "Parent 2"]);

    // Le premier parent demande Inès avec son compte existant : en attente, puis suivie une fois acceptée.
    await children.attachInvite(first.educator.id, (await inviteService.create(coach.id, ines.id)).token);
    expect((await children.pending(first.educator.id)).map((child) => child.name)).toEqual(["Inès"]);
    await acceptRequests(coach.id, ines.id);
    expect(await children.pending(first.educator.id)).toEqual([]);
    expect((await children.list(first.educator.id)).map((child) => [child.name, child.displayed])).toEqual([
      ["Léo", true],
      ["Inès", false],
    ]);

    await children.select(first.educator.id, ines.id);
    expect((await children.list(first.educator.id)).find((child) => child.displayed)?.name).toBe("Inès");
    // Le second parent ne suit pas Inès : il ne peut pas la choisir.
    await expect(children.select(second.educator.id, ines.id)).rejects.toBeInstanceOf(PlayerNotFoundError);
  });

  it("keeps the same link until the coach asks for a new one", async () => {
    const coach = await createCoach("again");
    const player = await playerRepository.create(coach.id, "Lou");
    const first = await inviteService.create(coach.id, player.id);

    expect((await inviteService.create(coach.id, player.id)).token).toBe(first.token);
    expect((await inviteService.current(coach.id, player.id))?.token).toBe(first.token);

    const renewed = await inviteService.create(coach.id, player.id, { renew: true });
    expect(renewed.token).not.toBe(first.token);
    expect(await inviteService.preview(first.token)).toBeNull();
    expect(await inviteService.preview(renewed.token)).not.toBeNull();
  });

  it("accepts several sign-ups with the same link, rejects a renewed or unknown one", async () => {
    const coach = await createCoach("consumed");
    const player = await playerRepository.create(coach.id, "Noah");
    const { token } = await inviteService.create(coach.id, player.id);
    for (const suffix of ["t3", "t3b"]) {
      await inviteService.consume(token, { email: `${testRun}-${suffix}@example.test`, password: "tutor-password", displayName: "Tuteur" });
    }
    expect((await tutorService.list(coach.id, player.id)).requests).toHaveLength(2);

    await inviteService.create(coach.id, player.id, { renew: true });
    await expect(inviteService.consume(token, { email: `${testRun}-x@example.test`, password: "x-password", displayName: "X" })).rejects.toBeInstanceOf(
      InviteInvalidError,
    );
    expect(await inviteService.preview("not-a-real-token")).toBeNull();
  });

  it("lets the coach refuse a request and remove a tutor", async () => {
    const coach = await createCoach("tutors");
    const player = await playerRepository.create(coach.id, "Maé");
    const { token } = await inviteService.create(coach.id, player.id);
    const accepted = await inviteService.consume(token, { email: `${testRun}-ok@example.test`, password: "tutor-password", displayName: "Accepté" });
    await inviteService.consume(token, { email: `${testRun}-no@example.test`, password: "tutor-password", displayName: "Refusé" });

    const { requests } = await tutorService.list(coach.id, player.id);
    const byName = new Map(requests.map((request) => [request.displayName, request.id]));
    await tutorService.answer(coach.id, player.id, byName.get("Accepté")!, true);
    const afterRefusal = await tutorService.answer(coach.id, player.id, byName.get("Refusé")!, false);
    expect(afterRefusal.requests).toEqual([]);
    expect(afterRefusal.tutors.map((tutor) => tutor.displayName)).toEqual(["Accepté"]);

    // Un autre éducateur ne voit pas ces tuteurs.
    const other = await createCoach("other");
    await expect(tutorService.list(other.id, player.id)).rejects.toBeInstanceOf(PlayerNotFoundError);

    const afterRemoval = await tutorService.remove(coach.id, player.id, accepted.educator.id);
    expect(afterRemoval.tutors).toEqual([]);
    expect((await educatorRepository.findById(accepted.educator.id))?.linkedPlayerId).toBeNull();
    await expect(dashboardService.get(accepted.educator.id)).rejects.toBeTruthy();
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
    await acceptRequests(coach.id, player.id);
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
    await acceptRequests(coach.id, player.id);
    const account = await authService.getPlayerAccountForSession(session.sessionToken);

    await playerRepository.remove(player.id, coach.id);

    expect(await educatorRepository.findById(account!.id)).toBeNull();
  });
});
