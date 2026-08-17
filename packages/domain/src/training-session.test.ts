import { describe, expect, it } from "vitest";
import type { DevelopmentWeek } from "./development-plan";
import {
  adjustBlockDuration,
  canValidateSession,
  generateTrainingSession,
  getSessionDuration,
  moveSessionBlock,
  replaceSessionActivity,
} from "./training-session";

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

const session = generateTrainingSession(developmentWeek, "U12", 14);

describe("training session editing", () => {
  it("édite une séance sans muter la proposition", () => {
    const longer = adjustBlockDuration(session, 0, 5);

    expect(getSessionDuration(longer)).toBe(80);
    expect(getSessionDuration(session)).toBe(75);
    expect(adjustBlockDuration(session, 0, -10).blocks[0].durationMinutes).toBe(5);
    expect(adjustBlockDuration(session, 0, -15).blocks[0].durationMinutes).toBe(5);
  });

  it("réordonne et remplace avec une activité compatible", () => {
    expect(moveSessionBlock(session, 0, 1).blocks[1].activity.kind).toBe("welcome");
    expect(moveSessionBlock(session, 0, -1)).toEqual(session);

    const replacement = replaceSessionActivity(session, 2);

    expect(replacement.blocks[2].activity.id).not.toBe(session.blocks[2].activity.id);
    expect(replacement.blocks[2].activity.compatibleThemes).toContain(session.theme);
  });

  it("valide uniquement une durée totale entre 60 et 90 minutes", () => {
    expect(canValidateSession(session)).toBe(true);
    expect(canValidateSession(adjustBlockDuration(session, 2, 20))).toBe(false);
  });
});
