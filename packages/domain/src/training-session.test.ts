import { describe, expect, it } from "vitest";
import type { DevelopmentWeek } from "./development-plan";
import { generateTrainingSession, getSessionDuration } from "./training-session";

const developmentWeek: DevelopmentWeek = {
  week: 1,
  phase: "Découvrir",
  theme: "Progresser ensemble",
  intention: "Créer des relations pour avancer sans isoler le porteur.",
  observable: "Les joueurs identifient le comportement attendu.",
};

describe("training session generation", () => {
  it("génère quatre blocs totalisant 75 minutes", () => {
    const session = generateTrainingSession(developmentWeek, "U12", 14);

    expect(session.blocks.map((block) => block.activity.kind)).toEqual([
      "welcome",
      "activation",
      "main",
      "game",
    ]);
    expect(getSessionDuration(session)).toBe(75);
    expect(generateTrainingSession(developmentWeek, "U12", 14)).toEqual(session);
  });
});
