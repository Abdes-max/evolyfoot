import { describe, expect, it } from "vitest";
import { buildPlayerEvaluationSeasons, createEmptyPlayerEvaluationScores, playerEvaluationAspects, validatePlayerEvaluationScores } from "./player-evaluation";

describe("player evaluation", () => {
  it("liste exactement sept aspects", () => {
    expect(playerEvaluationAspects).toHaveLength(7);
  });

  it("accepte des scores dans la plage 0-10", () => {
    const scores = createEmptyPlayerEvaluationScores();
    expect(validatePlayerEvaluationScores(scores)).toBeNull();
    expect(validatePlayerEvaluationScores({ ...scores, technique: 0, tir: 10 })).toBeNull();
  });

  it("rejette un score hors plage", () => {
    const scores = { ...createEmptyPlayerEvaluationScores(), technique: 11 };
    expect(validatePlayerEvaluationScores(scores)).toMatch(/0 à 10/);
  });

  it("rejette un score non entier", () => {
    const scores = { ...createEmptyPlayerEvaluationScores(), technique: 2.5 };
    expect(validatePlayerEvaluationScores(scores)).toMatch(/0 à 10/);
  });

  it("résume chaque saison et l’écart avec la précédente, la plus récente en premier", () => {
    const base = createEmptyPlayerEvaluationScores();
    const seasons = buildPlayerEvaluationSeasons([
      { scores: { ...base, technique: 8 }, createdAt: new Date(2027, 8, 10).toISOString() },
      { scores: { ...base, technique: 6 }, createdAt: new Date(2027, 6, 2).toISOString() },
      { scores: { ...base, technique: 2 }, createdAt: new Date(2027, 5, 20).toISOString() },
      { scores: { ...base, technique: 10 }, createdAt: new Date(2027, 8, 11).toISOString(), source: "player" },
    ]);
    expect(seasons.map((season) => season.label)).toEqual(["2027-2028", "2026-2027"]);
    expect(seasons[0]).toMatchObject({ count: 2, deltaFromPrevious: 0.7 });
    expect(seasons[0]!.averages.technique).toBe(7);
    expect(seasons[1]).toMatchObject({ count: 1, deltaFromPrevious: null, overall: 4.6 });
  });

  it("ne renvoie aucune saison sans évaluation de l’éducateur", () => {
    expect(buildPlayerEvaluationSeasons([])).toEqual([]);
  });
});
