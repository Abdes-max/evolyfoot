import { describe, expect, it } from "vitest";
import { CompetitionGamesService } from "./competition-games-service";
import { PlateauNotFoundError, TournamentNotFoundError } from "./errors";

const players = [
  { id: "lina", name: "Lina Durand" },
  { id: "sam", name: "Sam Petit" },
];

function setup() {
  const updates: unknown[] = [];
  const found = (id: string) => (id === "t-1" ? { id } : null);
  const service = new CompetitionGamesService(
    { listByEducator: async () => players as never },
    {
      findById: async (id: string) => found(id) as never,
      update: async (id: string, educatorId: string, input: unknown) => {
        updates.push({ kind: "tournament", id, educatorId, input });
        return {} as never;
      },
    },
    {
      findById: async (id: string) => (id === "p-1" ? ({ id } as never) : null),
      update: async (id: string, educatorId: string, input: unknown) => {
        updates.push({ kind: "plateau", id, educatorId, input });
        return {} as never;
      },
    },
  );
  return { service, updates };
}

const game = {
  id: "g1",
  opponent: " US Vallée ",
  goalsFor: 3,
  goalsAgainst: 1,
  playerStats: [{ playerId: "lina", playerName: "n'importe quoi", goals: 2, assists: 1 }],
};

describe("CompetitionGamesService", () => {
  it("enregistre les rencontres avec les noms de l'effectif et l'équipe rencontrée sans espaces", async () => {
    const { service, updates } = setup();

    const saved = await service.save("coach-1", "tournament", "t-1", [game]);

    expect(saved[0]).toMatchObject({ opponent: "US Vallée", playerStats: [{ playerId: "lina", playerName: "Lina Durand", goals: 2, assists: 1 }] });
    expect(updates).toEqual([{ kind: "tournament", id: "t-1", educatorId: "coach-1", input: { games: saved } }]);
  });

  it("sert aussi les plateaux et accepte une liste vide pour tout retirer", async () => {
    const { service, updates } = setup();
    await service.save("coach-1", "plateau", "p-1", []);
    expect(updates).toEqual([{ kind: "plateau", id: "p-1", educatorId: "coach-1", input: { games: [] } }]);
  });

  it("refuse une liste invalide, un joueur hors effectif et un score incohérent", async () => {
    const { service, updates } = setup();
    await expect(service.save("coach-1", "tournament", "t-1", "pas une liste")).rejects.toThrow("Rencontres invalides.");
    await expect(service.save("coach-1", "tournament", "t-1", [{ id: "x" }])).rejects.toThrow("Rencontres invalides.");
    await expect(
      service.save("coach-1", "tournament", "t-1", [{ ...game, playerStats: [{ playerId: "inconnu", playerName: "?", goals: 1, assists: 0 }] }]),
    ).rejects.toThrow("ne fait pas partie de l’effectif");
    await expect(service.save("coach-1", "tournament", "t-1", [{ ...game, goalsFor: 1 }])).rejects.toThrow("plus de buteurs que de buts");
    await expect(service.save("coach-1", "tournament", "t-1", [{ ...game, opponent: "" }])).rejects.toThrow("équipe rencontrée");
    expect(updates).toEqual([]);
  });

  it("signale un tournoi ou un plateau introuvable", async () => {
    const { service } = setup();
    await expect(service.save("coach-1", "tournament", "inconnu", [])).rejects.toBeInstanceOf(TournamentNotFoundError);
    await expect(service.save("coach-1", "plateau", "inconnu", [])).rejects.toBeInstanceOf(PlateauNotFoundError);
  });
});
