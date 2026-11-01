import { describe, expect, it } from "vitest";
import { defaultComparedEvaluationIds, evaluationLabel } from "./evaluation-colors";

describe("defaultComparedEvaluationIds", () => {
  it("retient la dernière note de l'éducateur et la dernière auto-évaluation", () => {
    const evaluations = [
      { id: "self-2", source: "player" as const },
      { id: "self-1", source: "player" as const },
      { id: "coach-2", source: "coach" as const },
      { id: "coach-1", source: "coach" as const },
    ];

    expect([...defaultComparedEvaluationIds(evaluations)]).toEqual(["coach-2", "self-2"]);
  });

  it("fonctionne avec une seule source ou un historique vide", () => {
    expect([...defaultComparedEvaluationIds([{ id: "coach-1" }])]).toEqual(["coach-1"]);
    expect([...defaultComparedEvaluationIds([{ id: "self-1", source: "player" }])]).toEqual(["self-1"]);
    expect(defaultComparedEvaluationIds([]).size).toBe(0);
  });
});

describe("evaluationLabel", () => {
  it("distingue l'auteur de l'évaluation", () => {
    expect(evaluationLabel({ id: "a", source: "player" }, "1 novembre 2026")).toBe("Auto-évaluation · 1 novembre 2026");
    expect(evaluationLabel({ id: "b", source: "coach" }, "1 novembre 2026")).toBe("Éducateur · 1 novembre 2026");
  });
});
