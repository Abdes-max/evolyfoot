import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { CompetitionConvocationService } from "./competition-convocation-service";
import { ValidationError } from "./errors";
import {
  PrismaEducatorRepository,
  PrismaMessageRepository,
  PrismaPlateauRepository,
  PrismaPlayerRepository,
  PrismaTournamentRepository,
} from "./prisma-repositories";

const testRun = `competition-cancel-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const playerRepository = new PrismaPlayerRepository(database.prisma);
const tournamentRepository = new PrismaTournamentRepository(database.prisma);
const plateauRepository = new PrismaPlateauRepository(database.prisma);
const messageRepository = new PrismaMessageRepository(database.prisma);
const service = new CompetitionConvocationService(educatorRepository, playerRepository, tournamentRepository, plateauRepository, messageRepository);

async function createCoach(suffix: string) {
  return educatorRepository.create({ email: `${testRun}-${suffix}@example.test`, displayName: `${testRun}-${suffix}`, passwordHash: "coach-password-hash" });
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
}

describe("annulation d'un tournoi ou d'un plateau", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("annule un tournoi convoqué avec un message aux joueurs concernés, puis le rétablit", async () => {
    const coach = await createCoach("tournament");
    const player = await playerRepository.create(coach.id, "Kylian");
    const tournament = await tournamentRepository.create(coach.id, {
      name: "Tournoi de printemps",
      dateLabel: "12 avril 2026",
      selectedPlayerIds: [player.id],
    });
    await service.send(coach.id, "tournament", tournament.id);

    const result = await service.cancel(coach.id, "tournament", tournament.id, "Trop de pluie.");

    expect(result).toMatchObject({ sentCount: 1, subject: "Annulation : tournoi « Tournoi de printemps »" });
    const texts = (await messageRepository.listByPlayer(coach.id, player.id)).map((message) => message.text);
    expect(texts).toContainEqual("Annulation : le tournoi « Tournoi de printemps » (12 avril 2026) est annulé. Trop de pluie.");
    const cancelled = await tournamentRepository.findById(tournament.id, coach.id);
    expect(cancelled).toMatchObject({ cancellationNote: "Trop de pluie." });
    expect(cancelled?.cancelledAt).toBeInstanceOf(Date);
    await expect(service.cancel(coach.id, "tournament", tournament.id)).rejects.toBeInstanceOf(ValidationError);

    await service.restore(coach.id, "tournament", tournament.id);
    expect((await tournamentRepository.findById(tournament.id, coach.id))?.cancelledAt).toBeNull();
  });

  it("annule un plateau sans message quand la convocation n'est pas partie", async () => {
    const coach = await createCoach("plateau");
    const player = await playerRepository.create(coach.id, "Kylian");
    const plateau = await plateauRepository.create(coach.id, { name: "Plateau de rentrée", dateLabel: "14 septembre 2026" });

    const result = await service.cancel(coach.id, "plateau", plateau.id);

    expect(result.sentCount).toBe(0);
    expect(await messageRepository.listByPlayer(coach.id, player.id)).toHaveLength(0);
    expect((await plateauRepository.findById(plateau.id, coach.id))?.cancelledAt).toBeInstanceOf(Date);
  });
});
