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

  it("accepte des scores dans la plage 1-5", () => {
    const scores = createEmptyPlayerEvaluationScores();
    expect(validatePlayerEvaluationScores(scores)).toBeNull();
  });

  it("rejette un score hors plage", () => {
    const scores = { ...createEmptyPlayerEvaluationScores(), technique: 6 };
    expect(validatePlayerEvaluationScores(scores)).toMatch(/1 à 5/);
  });

  it("rejette un score non entier", () => {
    const scores = { ...createEmptyPlayerEvaluationScores(), technique: 2.5 };
    expect(validatePlayerEvaluationScores(scores)).toMatch(/1 à 5/);
  });
});
