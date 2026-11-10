import { describe, expect, it } from "vitest";
import {
  competitionRecord,
  competitionRecordLabel,
  playerCompetitionGames,
  parseCompetitionGames,
  validateCompetitionGames,
  type CompetitionGame,
} from "./competition-games";
import { playerSeasonTotals } from "./match-result";

const lina = { playerId: "lina", playerName: "Lina", goals: 2, assists: 0 };
const game = (overrides: Partial<CompetitionGame> = {}): CompetitionGame => ({
  id: "g1",
  opponent: "US Vallée",
  goalsFor: 3,
  goalsAgainst: 1,
  playerStats: [lina],
  ...overrides,
});

describe("rencontres d'un tournoi", () => {
  it("accepte des rencontres valides et signale le premier problème", () => {
    expect(validateCompetitionGames([game(), game({ id: "g2", opponent: "FC Nord", goalsFor: 0, goalsAgainst: 0, playerStats: [] })])).toBeNull();
    expect(validateCompetitionGames([game({ opponent: "  " })])).toContain("équipe rencontrée");
    expect(validateCompetitionGames([game(), game()])).toBe("Une rencontre apparaît deux fois.");
    expect(validateCompetitionGames([game({ goalsFor: 1 })])).toContain("plus de buteurs que de buts");
    expect(validateCompetitionGames([game({ opponent: "x".repeat(61) })])).toContain("trop long");
    expect(validateCompetitionGames(Array.from({ length: 41 }, (_, index) => game({ id: `g${index}` })))).toContain("plus de 40");
  });

  it("ignore les entrées mal formées à la lecture", () => {
    expect(parseCompetitionGames(null)).toEqual([]);
    expect(parseCompetitionGames([game(), { id: 1 }, "x", { id: "g2", opponent: "FC", goalsFor: "3", goalsAgainst: 1 }])).toEqual([game()]);
    expect(parseCompetitionGames([{ ...game(), playerStats: [lina, { playerId: 4 }] }])[0]?.playerStats).toEqual([lina]);
  });

  it("résume le bilan", () => {
    const games = [
      game(),
      game({ id: "g2", goalsFor: 1, goalsAgainst: 1, playerStats: [] }),
      game({ id: "g3", goalsFor: 0, goalsAgainst: 2, playerStats: [] }),
      game({ id: "g4", playerStats: [] }),
    ];
    expect(competitionRecord(games)).toEqual({ played: 4, wins: 2, draws: 1, losses: 1, goalsFor: 7, goalsAgainst: 5 });
    expect(competitionRecordLabel(games)).toBe("2 victoires, 1 nul, 1 défaite");
    expect(competitionRecordLabel([])).toBe("");
  });

  it("compte les buts et passes des rencontres dans les totaux du joueur", () => {
    const totals = playerSeasonTotals([], "lina", [
      { games: [game(), game({ id: "g2", playerStats: [{ ...lina, goals: 1, assists: 1 }] })] },
      { games: undefined },
    ]);
    expect(totals).toEqual({ matches: 0, goals: 3, assists: 1 });
  });
});

describe("playerCompetitionGames", () => {
  it("liste les rencontres où le joueur a marqué ou passé, avec le tournoi et le score", () => {
    const competitions = [
      {
        name: "Tournoi de Noël",
        dateLabel: "20 décembre 2026",
        games: [game(), game({ id: "g2", playerStats: [{ ...lina, playerId: "sam", goals: 0, assists: 0 }] })],
      },
      { name: "Plateau", dateLabel: "10 janvier 2027" },
    ];
    expect(playerCompetitionGames(competitions, "lina")).toEqual([
      { competitionName: "Tournoi de Noël", dateLabel: "20 décembre 2026", opponent: "US Vallée", goalsFor: 3, goalsAgainst: 1, goals: 2, assists: 0 },
    ]);
    expect(playerCompetitionGames(competitions, "sam")).toEqual([]);
  });
});
