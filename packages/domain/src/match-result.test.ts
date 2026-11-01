import { describe, expect, it } from "vitest";
import { playerSeasonTotals, validateMatchResult } from "./match-result";

const stat = (playerId: string, goals: number, assists: number) => ({ playerId, playerName: playerId, goals, assists });

describe("résultat de match", () => {
  it("accepte un score sans buteurs renseignés", () => {
    expect(validateMatchResult({ goalsFor: 3, goalsAgainst: 1, playerStats: [] })).toBeNull();
  });

  it("refuse plus de buteurs ou de passeurs que de buts marqués", () => {
    expect(validateMatchResult({ goalsFor: 1, goalsAgainst: 0, playerStats: [stat("a", 2, 0)] })).toMatch(/buteurs/);
    expect(validateMatchResult({ goalsFor: 1, goalsAgainst: 0, playerStats: [stat("a", 1, 2)] })).toMatch(/passes/);
  });

  it("refuse un score invalide ou un joueur en double", () => {
    expect(validateMatchResult({ goalsFor: -1, goalsAgainst: 0, playerStats: [] })).toMatch(/score/);
    expect(validateMatchResult({ goalsFor: 1.5, goalsAgainst: 0, playerStats: [] })).toMatch(/score/);
    expect(validateMatchResult({ goalsFor: 2, goalsAgainst: 0, playerStats: [stat("a", 1, 0), stat("a", 1, 0)] })).toMatch(/deux fois/);
  });
});

describe("totaux de saison", () => {
  const base = { lineup: [{ playerId: "a" }], substitutePlayerIds: ["b"] };

  it("cumule les matchs joués et ignore ceux à venir", () => {
    const totals = playerSeasonTotals(
      [
        { ...base, status: "played", playerStats: [stat("a", 2, 1)] },
        { ...base, status: "played", playerStats: [stat("a", 0, 1)] },
        { ...base, status: "scheduled", playerStats: [stat("a", 5, 5)] },
      ],
      "a",
    );
    expect(totals).toEqual({ matches: 2, goals: 2, assists: 2 });
  });

  it("compte les remplaçants mais pas un joueur absent", () => {
    const attendance = [{ playerId: "b", present: false }];
    expect(playerSeasonTotals([{ ...base, status: "played" }], "b").matches).toBe(1);
    expect(playerSeasonTotals([{ ...base, status: "played", attendance }], "b").matches).toBe(0);
  });
});
