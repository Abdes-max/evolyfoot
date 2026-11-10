import { describe, expect, it } from "vitest";
import {
  competitionRecord,
  competitionRecordLabel,
  playerCompetitionGames,
  playerMatchGames,
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

describe("playerMatchGames", () => {
  const played = {
    status: "played",
    opponent: "FC Nord",
    dateLabel: "samedi 3 octobre",
    goalsFor: 2,
    goalsAgainst: 2,
    lineup: [{ playerId: "lina" }],
    substitutePlayerIds: ["sam"],
    playerStats: [lina],
  };
  it("liste les matchs joués par le joueur, même sans but, hors absents et matchs non joués", () => {
    const matches = [
      played,
      { ...played, opponent: "AS Est", goalsFor: null, goalsAgainst: null, playerStats: [] },
      { ...played, opponent: "Absent", attendance: [{ playerId: "lina", present: false }] },
      { ...played, opponent: "À venir", status: "scheduled" },
    ];
    expect(playerMatchGames(matches, "lina").map((game) => [game.opponent, game.goalsFor, game.goals])).toEqual([
      ["FC Nord", 2, 2],
      ["AS Est", null, 0],
    ]);
    expect(playerMatchGames(matches, "sam")).toHaveLength(3);
  });
});

describe("match joué sans composition", () => {
  it("compte les joueurs notés présents, ni les absents ni les autres", () => {
    const match = {
      status: "played",
      opponent: "FC Nord",
      dateLabel: "samedi",
      lineup: [],
      substitutePlayerIds: [],
      attendance: [
        { playerId: "lina", playerName: "Lina", present: true, status: "present" },
        { playerId: "sam", playerName: "Sam", present: false, status: "absent" },
      ],
      playerStats: [lina],
    } as never;
    expect(playerMatchGames([match], "lina")).toHaveLength(1);
    expect(playerMatchGames([match], "sam")).toHaveLength(0);
    expect(playerMatchGames([match], "autre")).toHaveLength(0);
    expect(playerSeasonTotals([match], "lina").matches).toBe(1);
    expect(playerSeasonTotals([match], "sam").matches).toBe(0);
  });
});
