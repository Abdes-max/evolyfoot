import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "./auth-service";
import { createDatabaseClient } from "./client";
import { EducatorNotFoundError, ValidationError } from "./errors";
import { PlayerInviteService } from "./player-invite-service";
import { PlayerRsvpService } from "./player-rsvp-service";
import {
  PrismaEducatorRepository,
  PrismaMatchRepository,
  PrismaPlayerInviteRepository,
  PrismaPlayerRepository,
  PrismaSessionRepository,
  PrismaTeamRepository,
} from "./prisma-repositories";

const testRun = `player-rsvp-${crypto.randomUUID()}`;
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
const matchRepository = new PrismaMatchRepository(database.prisma);

const authService = new AuthService(educatorRepository, sessionRepository);
const inviteService = new PlayerInviteService(educatorRepository, playerRepository, playerInviteRepository, teamRepository, authService);
const rsvpService = new PlayerRsvpService(educatorRepository, playerRepository, matchRepository);

async function createCoach(suffix: string) {
  return educatorRepository.create({
    email: `${testRun}-${suffix}@example.test`,
    displayName: `${testRun}-${suffix}`,
    passwordHash: "coach-password-hash",
  });
}

async function createTutorAccount(suffix: string) {
  const coach = await createCoach(suffix);
  const player = await playerRepository.create(coach.id, `${testRun}-${suffix}-player`);
  const { token } = await inviteService.create(coach.id, player.id);
  const session = await inviteService.consume(token, {
    email: `${testRun}-${suffix}-tutor@example.test`,
    password: "tutor-password",
    displayName: "Tuteur",
  });
  const account = await authService.getPlayerAccountForSession(session.sessionToken);
  return { coach, player, tutorAccountId: account!.id };
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
}

describe("PlayerRsvpService", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("records the tutor's own RSVP without touching other players' entries", async () => {
    const { coach, player, tutorAccountId } = await createTutorAccount("rsvp");
    const other = await playerRepository.create(coach.id, "Autre joueur");
    const match = await matchRepository.create(coach.id, {
      opponent: "US Vallée",
      dateLabel: "Samedi",
      venue: "home",
      gameFormat: 8,
      formationId: "3-3-1",
    });
    await matchRepository.update(match.id, coach.id, {
      attendance: [{ playerId: other.id, playerName: "Autre joueur", present: true }],
    });

    await rsvpService.respondToMatch(tutorAccountId, match.id, "injured");

    const reloaded = await matchRepository.findById(match.id, coach.id);
    expect(reloaded!.attendance).toHaveLength(2);
    const mine = reloaded!.attendance!.find((entry) => entry.playerId === player.id);
    expect(mine).toMatchObject({ playerName: `${testRun}-rsvp-player`, status: "injured", present: false });
    const theirs = reloaded!.attendance!.find((entry) => entry.playerId === other.id);
    expect(theirs).toMatchObject({ present: true });
  });

  it("responding twice replaces the previous answer rather than duplicating it", async () => {
    const { coach, tutorAccountId } = await createTutorAccount("twice");
    const match = await matchRepository.create(coach.id, {
      opponent: "US Vallée",
      dateLabel: "Samedi",
      venue: "home",
      gameFormat: 8,
      formationId: "3-3-1",
    });

    await rsvpService.respondToMatch(tutorAccountId, match.id, "late");
    await rsvpService.respondToMatch(tutorAccountId, match.id, "present");

    const reloaded = await matchRepository.findById(match.id, coach.id);
    expect(reloaded!.attendance).toHaveLength(1);
    expect(reloaded!.attendance![0]!.status).toBe("present");
  });

  it("rejects a coach account (only player accounts can RSVP)", async () => {
    const coach = await createCoach("coach-only");
    await expect(rsvpService.respondToMatch(coach.id, "any-match", "present")).rejects.toBeInstanceOf(EducatorNotFoundError);
  });

  it("rejects RSVPing to an already-played match", async () => {
    const { coach, tutorAccountId } = await createTutorAccount("played");
    const match = await matchRepository.create(coach.id, {
      opponent: "US Vallée",
      dateLabel: "Samedi",
      venue: "home",
      gameFormat: 8,
      formationId: "3-3-1",
    });
    await matchRepository.update(match.id, coach.id, { status: "played" });

    await expect(rsvpService.respondToMatch(tutorAccountId, match.id, "present")).rejects.toBeInstanceOf(ValidationError);
  });
});
