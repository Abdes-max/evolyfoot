import { describe, expect, it } from "vitest";
import {
  createEmptyPlayerEvaluationScores,
  playerEvaluationAspects,
  validatePlayerEvaluationScores,
} from "./player-evaluation";

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
});
