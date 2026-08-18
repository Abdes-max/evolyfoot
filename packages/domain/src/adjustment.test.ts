import { describe, expect, it } from "vitest";
import type { DevelopmentWeek } from "./development-plan";
import type { ObservationEventType, ObservationReport } from "./observation";
import { suggestAdjustmentFromObservation } from "./adjustment";

const currentWeek: DevelopmentWeek = {
  week: 2,
  phase: "Stabiliser",
  theme: "Progresser ensemble",
  intention: "Créer des relations pour avancer sans isoler le porteur.",
  observable: "Les joueurs proposent une solution après chaque passe.",
};

const reportWith = (
  scores: Partial<Record<ObservationReport["ratings"][number]["criterion"], number>> = {},
  eventType: ObservationEventType = "training",
): ObservationReport => {
  const values = {
    availability: 100,
    scanning: 100,
    progression: 100,
    reactionAfterLoss: 100,
    ...scores,
  };
  const ratings: ObservationReport["ratings"] = Object.entries(values).map(([criterion, score]) => ({
    criterion: criterion as ObservationReport["ratings"][number]["criterion"],
    level: (score === 0 ? "reinforce" : score === 50 ? "progress" : "achieved") as ObservationReport["ratings"][number]["level"],
    score,
  }));

  return {
    id: "report-42",
    eventType,
    title: "Observation du mardi",
    dateLabel: "18 août 2026",
    players: [{ id: "player-1", name: "Lina" }],
    ratings,
    signals: [{ playerId: "player-1", playerName: "Lina", kind: "highlight" }],
    note: "Rester attentif aux transitions.",
    summary: {
      averageScore: Object.values(values).reduce((sum, score) => sum + score, 0) / 4,
      trend: "achieved",
      strongest: { ...ratings[0], label: "Se rendre disponible" },
      weakest: { ...ratings[0], label: "Se rendre disponible" },
    },
  };
};

describe("suggestAdjustmentFromObservation", () => {
  it("reinforces the weakest zero-score behavior with an explainable reason", () => {
    const suggestion = suggestAdjustmentFromObservation(reportWith({ reactionAfterLoss: 0 }), currentWeek);

    expect(suggestion.action).toBe("reinforce");
    expect(suggestion.reason).toContain("Réagir après la perte");
    expect(suggestion.reason).toContain("0/100");
    expect(suggestion.proposedTheme).toBe("Récupérer rapidement");
    expect(suggestion.triggerScore).toBe(0);
  });

  it("progresses when the average is exactly 75 without a zero score", () => {
    const suggestion = suggestAdjustmentFromObservation(
      reportWith({ availability: 50, scanning: 50 }),
      currentWeek,
    );

    expect(suggestion.action).toBe("progress");
    expect(suggestion.triggerScore).toBe(75);
    expect(suggestion.proposedTheme).toBe(currentWeek.theme);
  });

  it("maintains the current direction for middle scores below the progress threshold", () => {
    const suggestion = suggestAdjustmentFromObservation(
      reportWith({ availability: 50, scanning: 50, progression: 50 }),
      currentWeek,
    );

    expect(suggestion.action).toBe("maintain");
    expect(suggestion.reason).toContain("50/100");
    expect(suggestion.proposedTheme).toBe(currentWeek.theme);
  });

  it("selects the first diagnostic criterion when the weakest score is tied", () => {
    const suggestion = suggestAdjustmentFromObservation(
      reportWith({ availability: 0, scanning: 0 }),
      currentWeek,
    );

    expect(suggestion.proposedTheme).toBe("Conserver le ballon");
    expect(suggestion.reason).toContain("Se rendre disponible");
  });

  it.each<ObservationEventType>(["training", "match"])(
    "accepts a %s observation report",
    (eventType) => {
      const suggestion = suggestAdjustmentFromObservation(reportWith({}, eventType), currentWeek);

      expect(suggestion.action).toBe("progress");
      expect(suggestion.id).toContain("report-42");
    },
  );

  it("rejects reports that do not contain the four unique canonical criteria", () => {
    const report = reportWith();
    const malformed = {
      ...report,
      ratings: report.ratings.slice(0, 3),
    } as ObservationReport;

    expect(() => suggestAdjustmentFromObservation(malformed, currentWeek)).toThrow(/critères/i);
  });

  it("rejects scores other than 0, 50, or 100", () => {
    const report = reportWith({ scanning: 75 });

    expect(() => suggestAdjustmentFromObservation(report, currentWeek)).toThrow(/0, 50 et 100/i);
  });

  it("does not mutate deeply nested report or week input data", () => {
    const report = reportWith({ reactionAfterLoss: 0 });
    const reportBefore = JSON.stringify(report);
    const weekBefore = JSON.stringify(currentWeek);

    suggestAdjustmentFromObservation(report, currentWeek);

    expect(JSON.stringify(report)).toBe(reportBefore);
    expect(JSON.stringify(currentWeek)).toBe(weekBefore);
  });

  it("returns a deeply frozen plain suggestion that survives JSON round-trip", () => {
    const suggestion = suggestAdjustmentFromObservation(reportWith({ reactionAfterLoss: 0 }), currentWeek);

    expect(Object.isFrozen(suggestion)).toBe(true);
    expect(Object.getPrototypeOf(suggestion)).toBe(Object.prototype);
    expect(JSON.parse(JSON.stringify(suggestion))).toEqual(suggestion);
  });
});
