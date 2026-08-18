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

  it("preserves a draft note while it is being typed and trims it only on completion", () => {
    const draft = createObservationDraft("training", "Séance 1", players);
    const noted = setObservationNote(draft, "  Belle largeur dans les temps  ");
    const blank = setObservationNote(draft, "   ");

    expect(noted.note).toBe("  Belle largeur dans les temps  ");
    expect(blank.note).toBe("   ");
    const completedNoted = completeObservation(
      diagnosticCriteria.reduce(
        (current, criterion) => rateObservation(current, criterion.id, "progress"),
        noted,
      ),
    );
    const completedBlank = completeObservation(
      diagnosticCriteria.reduce(
        (current, criterion) => rateObservation(current, criterion.id, "progress"),
        blank,
      ),
    );

    expect(completedNoted.note).toBe("Belle largeur dans les temps");
    expect(completedBlank).not.toHaveProperty("note");
  });

  it("keeps every transition input deeply immutable and preserves tie order", () => {
    const draft = createObservationDraft("training", "Séance 1", players);
    const draftSnapshot = JSON.parse(JSON.stringify(draft)) as typeof draft;

    const rated = rateObservation(draft, "availability", "progress");
    expect(rated).not.toBe(draft);
    expect(rated.ratings).not.toBe(draft.ratings);
    expect(rated.players).not.toBe(draft.players);
    expect(rated.players[0]).not.toBe(draft.players[0]);
    expect(rated.ratings).toEqual([{ criterion: "availability", level: "progress" }]);
    expect(draft).toEqual(draftSnapshot);

    const ratedSnapshot = JSON.parse(JSON.stringify(rated)) as typeof rated;
    const signaled = togglePlayerSignal(rated, "lina", "highlight");
    expect(signaled).not.toBe(rated);
    expect(signaled.signals).not.toBe(rated.signals);
    expect(signaled.signals).toEqual([{ playerId: "lina", playerName: "Lina", kind: "highlight" }]);
    expect(rated).toEqual(ratedSnapshot);

    const signaledSnapshot = JSON.parse(JSON.stringify(signaled)) as typeof signaled;
    const noted = setObservationNote(signaled, "  Note utile  ");
    expect(noted).not.toBe(signaled);
    expect(noted.note).toBe("  Note utile  ");
    expect(signaled).toEqual(signaledSnapshot);

    const completeDraft = ratedDraft();
    const completeDraftSnapshot = JSON.parse(JSON.stringify(completeDraft)) as typeof completeDraft;
    const complete = completeObservation(completeDraft);
    expect(completeDraft).toEqual(completeDraftSnapshot);
    expect(complete).not.toBe(completeDraft);
    expect(complete.ratings).not.toBe(completeDraft.ratings);
    expect(Object.isFrozen(complete)).toBe(true);
    expect(Object.isFrozen(complete.ratings)).toBe(true);
    expect(complete.summary.strongest.criterion).toBe("availability");
    expect(complete.summary.weakest.criterion).toBe("availability");
  });

  it("rejects incomplete completion with the domain error", () => {
    expect(() => completeObservation(createObservationDraft("training", "Séance 1", players))).toThrow(
      "Les quatre comportements doivent être renseignés.",
    );
  });

  it("serializes a non-uniform report with its strongest, weakest and trend", () => {
    const draft = rateObservation(
      rateObservation(
        rateObservation(
          rateObservation(createObservationDraft("match", "Match 1", players), "availability", "achieved"),
          "scanning",
          "reinforce",
        ),
        "progression",
        "progress",
      ),
      "reactionAfterLoss",
      "progress",
    );

    const report = completeObservation(draft);

    expect(report.summary).toMatchObject({
      trend: "progress",
      strongest: { criterion: "availability", score: 100 },
      weakest: { criterion: "scanning", score: 0 },
    });
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
});
