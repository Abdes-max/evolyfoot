import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "./auth-service";
import { createDatabaseClient } from "./client";
import { EducatorNotFoundError, PlayerNotFoundError, ValidationError } from "./errors";
import { MessagingService } from "./messaging-service";
import { PlayerInviteService } from "./player-invite-service";
import {
  PrismaEducatorRepository,
  PrismaMessageRepository,
  PrismaPlayerInviteRepository,
  PrismaPlayerRepository,
  PrismaSessionRepository,
  PrismaTeamRepository,
} from "./prisma-repositories";

const testRun = `messaging-${crypto.randomUUID()}`;
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
const messageRepository = new PrismaMessageRepository(database.prisma);

const authService = new AuthService(educatorRepository, sessionRepository);
const inviteService = new PlayerInviteService(educatorRepository, playerRepository, playerInviteRepository, teamRepository, authService);
const messagingService = new MessagingService(educatorRepository, playerRepository, messageRepository);

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
    displayName: `Parent de ${testRun}-${suffix}`,
  });
  const account = await authService.getPlayerAccountForSession(session.sessionToken);
  return { coach, player, tutorAccountId: account!.id, tutorDisplayName: `Parent de ${testRun}-${suffix}` };
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
}

describe("MessagingService", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("le coach et le tuteur voient le même fil, dans l'ordre chronologique", async () => {
    const { coach, player, tutorAccountId, tutorDisplayName } = await createTutorAccount("thread");

    await messagingService.sendAsCoach(coach.id, player.id, "Bonjour, tout va bien ?");
    await messagingService.sendAsPlayerAccount(tutorAccountId, "Oui, on sera là samedi !");

    const fromCoach = await messagingService.listForCoach(coach.id, player.id);
    const fromTutor = await messagingService.listForPlayerAccount(tutorAccountId);

    expect(fromCoach).toHaveLength(2);
    expect(fromTutor).toHaveLength(2);
    expect(fromCoach.map((m) => ({ authorRole: m.authorRole, authorName: m.authorName, text: m.text }))).toEqual([
      { authorRole: "coach", authorName: coach.displayName, text: "Bonjour, tout va bien ?" },
      { authorRole: "player", authorName: tutorDisplayName, text: "Oui, on sera là samedi !" },
    ]);
    expect(fromTutor).toEqual(fromCoach);
  });

  it("rejette un message vide", async () => {
    const { coach, player, tutorAccountId } = await createTutorAccount("empty");
    await expect(messagingService.sendAsCoach(coach.id, player.id, "   ")).rejects.toBeInstanceOf(ValidationError);
    await expect(messagingService.sendAsPlayerAccount(tutorAccountId, "")).rejects.toBeInstanceOf(ValidationError);
  });

  it("un coach ne peut pas écrire à un joueur qui n'est pas le sien", async () => {
    const owner = await createCoach("owner");
    const stranger = await createCoach("stranger");
    const player = await playerRepository.create(owner.id, "Joueur d'un autre coach");

    await expect(messagingService.sendAsCoach(stranger.id, player.id, "Salut")).rejects.toBeInstanceOf(PlayerNotFoundError);
    await expect(messagingService.listForCoach(stranger.id, player.id)).rejects.toBeInstanceOf(PlayerNotFoundError);
  });

  it("rejette un compte coach essayant d'écrire côté joueur", async () => {
    const coach = await createCoach("coach-only");
    await expect(messagingService.sendAsPlayerAccount(coach.id, "Salut")).rejects.toBeInstanceOf(EducatorNotFoundError);
  });
});
