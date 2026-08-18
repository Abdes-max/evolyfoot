import { describe, expect, it } from "vitest";
import {
  canCompleteObservation,
  completeObservation,
  createObservationDraft,
  diagnosticCriteria,
  rateObservation,
  setObservationNote,
  togglePlayerSignal,
} from "./index";
import type { PlayerReference } from "./observation";

const players: PlayerReference[] = [
  { id: "lina", name: "Lina" },
  { id: "noe", name: "Noé" },
];

function ratedDraft() {
  return diagnosticCriteria.reduce(
    (current, criterion) => rateObservation(current, criterion.id, "progress"),
    createObservationDraft("training", "Séance 1", players),
  );
}

describe("quick observation domain", () => {
  it("requires all four diagnostic criteria before completion", () => {
    const draft = createObservationDraft("training", "Séance 1", players);
    expect(canCompleteObservation(draft)).toBe(false);

    const rated = ratedDraft();
    expect(canCompleteObservation(rated)).toBe(true);
    expect(completeObservation(rated).summary.averageScore).toBe(50);
  });

  it("normalizes observation levels to 0, 50 and 100", () => {
    const draft = createObservationDraft("match", "Match 1", players);
    const rated = rateObservation(
      rateObservation(
        rateObservation(draft, "availability", "reinforce"),
        "scanning",
        "progress",
      ),
      "progression",
      "achieved",
    );
    const complete = rateObservation(rated, "reactionAfterLoss", "progress");

    expect(completeObservation(complete).ratings.map((rating) => rating.score)).toEqual([0, 50, 100, 50]);
  });

  it("toggles a signal off and replaces an opposite signal", () => {
    const draft = createObservationDraft("training", "Séance 1", players);
    const highlighted = togglePlayerSignal(draft, "lina", "highlight");
    expect(highlighted.signals).toEqual([{ playerId: "lina", playerName: "Lina", kind: "highlight" }]);

    const supported = togglePlayerSignal(highlighted, "lina", "support");
    expect(supported.signals).toEqual([{ playerId: "lina", playerName: "Lina", kind: "support" }]);
    expect(togglePlayerSignal(supported, "lina", "support").signals).toEqual([]);
  });

  it("ignores unknown criteria and players", () => {
    const draft = createObservationDraft("training", "Séance 1", players);
    expect(rateObservation(draft, "unknown" as never, "progress")).toBe(draft);
    expect(togglePlayerSignal(draft, "unknown", "highlight")).toBe(draft);
  });

  it("trims notes and removes blank notes", () => {
    const draft = createObservationDraft("training", "Séance 1", players);
    expect(setObservationNote(draft, "  Belle largeur dans les temps  ").note).toBe("Belle largeur dans les temps");
    expect(setObservationNote(draft, "   ").note).toBeUndefined();
  });

  it("does not mutate the input draft and keeps diagnostic order for ties", () => {
    const draft = createObservationDraft("training", "Séance 1", players);
    const rated = ratedDraft();
    expect(draft.ratings).toEqual([]);
    expect(draft.signals).toEqual([]);
    expect(completeObservation(rated).summary.strongest.criterion).toBe("availability");
    expect(completeObservation(rated).summary.weakest.criterion).toBe("availability");
  });

  it("rejects incomplete completion with the domain error", () => {
    expect(() => completeObservation(createObservationDraft("training", "Séance 1", players))).toThrow(
      "Les quatre comportements doivent être renseignés.",
    );
  });
});
