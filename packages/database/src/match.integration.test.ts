import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { defaultFormationId, formationSlots, listFormations } from "@evolyfoot/domain";
import type { MatchLineupAssignment } from "@evolyfoot/domain";
import { createDatabaseClient } from "./client";
import { MatchNotFoundError, ValidationError } from "./errors";
import { MatchService } from "./match-service";
import { PrismaEducatorRepository, PrismaMatchRepository } from "./prisma-repositories";

const testRun = `match-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const matchRepository = new PrismaMatchRepository(database.prisma);
const service = new MatchService(educatorRepository, matchRepository);

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

describe("PostgreSQL match persistence", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("crée un match programmé, sans composition ni capitaine", async () => {
    const educator = await createEducator("create");
    const match = await service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi 12 septembre · 10:30", venue: "home", gameFormat: 8 });

    expect(match.opponent).toBe("US Vallée");
    expect(match.status).toBe("scheduled");
    expect(match.lineup).toEqual([]);
    expect(match.captainPlayerId).toBeNull();
  });

  it("liste les matchs du plus récent au plus ancien", async () => {
    const educator = await createEducator("list");
    await service.create(educator.id, { opponent: "US Vallée", dateLabel: "S1", venue: "home", gameFormat: 8 });
    await service.create(educator.id, { opponent: "AS Rivière", dateLabel: "S2", venue: "away", gameFormat: 8 });

    const matches = await service.list(educator.id);

    expect(matches.map((match) => match.opponent)).toEqual(["AS Rivière", "US Vallée"]);
  });

  it("crée un match avec la formation par défaut du format de jeu", async () => {
    const educator = await createEducator("default-formation");
    const match = await service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 8 });

    expect(match.formationId).toBe(defaultFormationId(8));
  });

  it("rejette un identifiant de formation qui ne correspond pas au format de jeu", async () => {
    const educator = await createEducator("bad-formation");
    const otherFormatFormationId = listFormations(11)[0]!.id;

    await expect(
      service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 4, formationId: otherFormatFormationId }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("met à jour la composition et le capitaine", async () => {
    const educator = await createEducator("lineup");
    const match = await service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 4 });
    const slots = formationSlots(4, match.formationId);
    const lineup = slots.map((slot, index) => ({ slotId: slot.id, playerId: `player-${index}`, playerName: `Joueur ${index}` }));

    const updated = await service.updateLineup(educator.id, match.id, { lineup, captainPlayerId: "player-0" });

    expect(updated.lineup).toEqual(lineup);
    expect(updated.captainPlayerId).toBe("player-0");
  });

  it("rejette un identifiant de poste qui n’existe pas dans la formation du format de jeu", async () => {
    const educator = await createEducator("bad-slot");
    const match = await service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 4 });

    await expect(
      service.updateLineup(educator.id, match.id, {
        lineup: [{ slotId: "attacker-9", playerId: "player-0", playerName: "Joueur 0" }],
        captainPlayerId: null,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejette un capitaine qui ne fait pas partie des titulaires", async () => {
    const educator = await createEducator("bad-captain");
    const match = await service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 4 });
    const slot = formationSlots(4, match.formationId)[0]!;

    await expect(
      service.updateLineup(educator.id, match.id, {
        lineup: [{ slotId: slot.id, playerId: "player-0", playerName: "Joueur 0" }],
        captainPlayerId: "player-1",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuse de marquer un match joué tant que la composition est incomplète", async () => {
    const educator = await createEducator("incomplete");
    const match = await service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 4 });

    await expect(service.markPlayed(educator.id, match.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it("marque un match joué une fois la composition complète et le capitaine désigné", async () => {
    const educator = await createEducator("played");
    const match = await service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 4 });
    const slots = formationSlots(4, match.formationId);
    const lineup = slots.map((slot, index) => ({ slotId: slot.id, playerId: `player-${index}`, playerName: `Joueur ${index}` }));
    await service.updateLineup(educator.id, match.id, { lineup, captainPlayerId: "player-0" });

    const played = await service.markPlayed(educator.id, match.id);

    expect(played.status).toBe("played");
  });

  it("change de formation et repart d'une composition vide", async () => {
    const educator = await createEducator("change-formation");
    const match = await service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 8 });
    const slots = formationSlots(8, match.formationId);
    const lineup: MatchLineupAssignment[] = slots.map((slot, index) => ({ slotId: slot.id, playerId: `player-${index}`, playerName: `Joueur ${index}` }));
    await service.updateLineup(educator.id, match.id, { lineup, captainPlayerId: "player-0" });
    const nextFormationId = listFormations(8)[1]!.id;

    const updated = await service.changeFormation(educator.id, match.id, nextFormationId);

    expect(updated.formationId).toBe(nextFormationId);
    expect(updated.lineup).toEqual([]);
    expect(updated.captainPlayerId).toBeNull();
  });

  it("rejette un changement vers une formation d'un autre format de jeu", async () => {
    const educator = await createEducator("change-formation-bad");
    const match = await service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 4 });
    const otherFormatFormationId = listFormations(11)[0]!.id;

    await expect(service.changeFormation(educator.id, match.id, otherFormatFormationId)).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejette l’accès à un match appartenant à un autre éducateur", async () => {
    const owner = await createEducator("owner");
    const stranger = await createEducator("stranger");
    const match = await service.create(owner.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 8 });

    await expect(service.get(stranger.id, match.id)).rejects.toBeInstanceOf(MatchNotFoundError);
    await expect(
      service.updateLineup(stranger.id, match.id, { lineup: [], captainPlayerId: null }),
    ).rejects.toBeInstanceOf(MatchNotFoundError);
  });

  it("supprime un match appartenant à l’éducateur", async () => {
    const educator = await createEducator("remove");
    const match = await service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 8 });

    await service.remove(educator.id, match.id);

    await expect(service.list(educator.id)).resolves.toHaveLength(0);
  });

  it("cascade la suppression d’un éducateur de test vers ses matchs", async () => {
    const educator = await createEducator("cascade");
    await service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 8 });

    await database.prisma.educator.delete({ where: { id: educator.id } });

    await expect(database.prisma.matchRecord.count({ where: { educatorId: educator.id } })).resolves.toBe(0);
  });

  it("crée un match sans rendez-vous/lieu/description par défaut, tous les trois optionnels à la création", async () => {
    const educator = await createEducator("details-default");
    const match = await service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 8 });

    expect(match.meetingTime).toBeNull();
    expect(match.location).toBeNull();
    expect(match.description).toBeNull();
  });

  it("accepte rendez-vous/lieu/description à la création", async () => {
    const educator = await createEducator("details-create");
    const match = await service.create(educator.id, {
      opponent: "US Vallée",
      dateLabel: "Samedi",
      venue: "home",
      gameFormat: 8,
      meetingTime: "14:30",
      location: "Stade Marius Requier, Aix-en-Provence",
      description: "Brassage journée 1 (triangulaire)",
    });

    expect(match.meetingTime).toBe("14:30");
    expect(match.location).toBe("Stade Marius Requier, Aix-en-Provence");
    expect(match.description).toBe("Brassage journée 1 (triangulaire)");
  });

  it("modifie rendez-vous/lieu/description indépendamment de la composition, même une fois le match joué", async () => {
    const educator = await createEducator("details-update");
    const match = await service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 8 });

    const updated = await service.updateDetails(educator.id, match.id, { location: "Stade Marius Requier" });
    expect(updated.location).toBe("Stade Marius Requier");
    expect(updated.meetingTime).toBeNull();

    await database.prisma.matchRecord.update({ where: { id: match.id }, data: { status: "played" } });
    const afterPlayed = await service.updateDetails(educator.id, match.id, { meetingTime: "14:30" });
    expect(afterPlayed.meetingTime).toBe("14:30");
    expect(afterPlayed.location).toBe("Stade Marius Requier");
  });

  it("efface un champ de détail avec une chaîne vide ou null", async () => {
    const educator = await createEducator("details-clear");
    const match = await service.create(educator.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 8, location: "Stade X" });

    const cleared = await service.updateDetails(educator.id, match.id, { location: "  " });
    expect(cleared.location).toBeNull();
  });

  it("rejette la modification des détails d’un match appartenant à un autre éducateur", async () => {
    const owner = await createEducator("details-owner");
    const stranger = await createEducator("details-stranger");
    const match = await service.create(owner.id, { opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 8 });

    await expect(
      service.updateDetails(stranger.id, match.id, { location: "Ailleurs" }),
    ).rejects.toBeInstanceOf(MatchNotFoundError);
  });
});
