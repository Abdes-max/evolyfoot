import { describe, expect, it } from "vitest";
import { developmentThemes } from "./themes";
import { generateTrainingSession, findTrainingActivity } from "./training-session";
import { programSessions } from "./program-sessions";
import { programSessionsU12 } from "./program-sessions-u12";
import { findProgramSituation } from "./program-situations";
import {
  buildPrioritizedSeason,
  findProgramSession,
  isActivityForBand,
  programBandOf,
  programSessionLabelNumber,
  programSessionPlan,
  situationMinutes,
} from "./season-program";

describe("programmation U12-U13", () => {
  it("compte 72 séances numérotées de 101 à 172, avec les mêmes évaluations que les U10-U11", () => {
    expect(programSessionsU12).toHaveLength(72);
    expect(programSessionsU12.map((session) => session.number)).toEqual(Array.from({ length: 72 }, (_, index) => 101 + index));
    const kinds = (list: typeof programSessions) => list.map((session) => session.type);
    expect(kinds(programSessionsU12)).toEqual(kinds(programSessions));
  });

  it("référence uniquement des situations qui existent, et chaque séance dure entre 60 et 90 minutes", () => {
    for (const session of programSessionsU12) {
      const plan = programSessionPlan(session.number);
      expect(plan, `séance ${session.number}`).not.toBeNull();
      for (const block of plan!.blocks) {
        expect(findTrainingActivity(block.activityId), `${session.number} ${block.activityId}`).toBeDefined();
      }
      if (session.type !== "evaluation") {
        for (const id of session.situations) expect(findProgramSituation(id), id).toBeDefined();
      }
      const total = plan!.blocks.reduce((sum, block) => sum + block.durationMinutes, 0);
      expect(total, `séance ${session.number}`).toBeGreaterThanOrEqual(60);
      expect(total, `séance ${session.number}`).toBeLessThanOrEqual(90);
    }
    expect(situationMinutes(findProgramSituation("cfi-u12-lignes-bandes-jeu")!)).toBeGreaterThan(0);
  });

  it("affiche le numéro de la séance sans le décalage, et choisit la programmation selon la catégorie", () => {
    expect(programSessionLabelNumber(103)).toBe(3);
    expect(programSessionLabelNumber(3)).toBe(3);
    expect(findProgramSession(103)?.type).toBe("theme");
    expect(programSessionPlan(103)!.title).toMatch(/^Séance 3 · /);
    expect(["U10", "U11"].map((age) => programBandOf(age as "U10" | "U11"))).toEqual(["u10u11", "u10u11"]);
    expect(["U12", "U13"].map((age) => programBandOf(age as "U12" | "U13"))).toEqual(["u12u13", "u12u13"]);
  });

  it("construit la saison des U12-U13 avec leurs séances, celle des U10-U11 avec les leurs", () => {
    const priorities = [developmentThemes[0]!];
    const numbers = (ageGroup?: "U10" | "U12") =>
      buildPrioritizedSeason({ priorities, sessionsPerWeek: 2, ageGroup }).flatMap((week) => week.slots.map((slot) => slot.sessionNumber));
    expect(numbers("U12").every((number) => number > 100)).toBe(true);
    expect(numbers("U10").every((number) => number <= 72)).toBe(true);
    expect(numbers(undefined)).toEqual(numbers("U10"));
    expect(numbers("U12")).toHaveLength(72);
  });

  it("propose les exercices U12-U13 aux U12 et U13 seulement, les situations communes aux deux", () => {
    expect(isActivityForBand("cfi-u12-bloc-toro", "u12u13")).toBe(true);
    expect(isActivityForBand("cfi-u12-bloc-toro", "u10u11")).toBe(false);
    expect(isActivityForBand("welcome-conserver", "u12u13")).toBe(false);
    expect(isActivityForBand("welcome-conserver", "u10u11")).toBe(true);
    expect(isActivityForBand("cfi-recre-futsal", "u12u13")).toBe(true);
    expect(isActivityForBand("cfi-recre-futsal", "u10u11")).toBe(true);
  });

  it("génère les séances d'une équipe U12 avec des exercices U12-U13", () => {
    const week = { week: 1, phase: "Découvrir", theme: developmentThemes[0]!, intention: "Test", observable: "Test" } as const;
    const session = generateTrainingSession(week, "U12", 16, 0);
    expect(session.blocks.every((block) => isActivityForBand(block.activity.id, "u12u13"))).toBe(true);
    const u11 = generateTrainingSession(week, "U11", 16, 0);
    expect(u11.blocks.every((block) => isActivityForBand(block.activity.id, "u10u11"))).toBe(true);
  });
});

describe("étiquette de catégorie des exercices", () => {
  it("étiquette les exercices U10-U11, U12-U13 et communs", async () => {
    const { activityCategoryOf, activityCategoryLabels } = await import("./season-program");
    const { trainingActivityCatalogue } = await import("./training-session");
    expect(activityCategoryOf("welcome-conserver")).toBe("U10-U11");
    expect(activityCategoryOf("cfi-demarque-duel")).toBe("U10-U11");
    expect(activityCategoryOf("cfi-u12-bloc-toro")).toBe("U12-U13");
    expect(activityCategoryOf("cfi-recre-futsal")).toBe("U10-U13");
    expect(activityCategoryLabels["U10-U13"]).toBe("U10-U11-U12-U13");
    const counts = new Map<string, number>();
    for (const activity of trainingActivityCatalogue) counts.set(activity.category!, (counts.get(activity.category!) ?? 0) + 1);
    expect(counts.get("U12-U13")).toBeGreaterThan(40);
    expect(counts.get("U10-U13")).toBe(6);
    expect([...counts.keys()].sort()).toEqual(["U10-U11", "U10-U13", "U12-U13"]);
  });
});
