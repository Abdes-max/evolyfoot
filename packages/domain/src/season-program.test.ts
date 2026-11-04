import { describe, expect, it } from "vitest";
import { developmentThemes, generateTrainingSession } from "./index";
import { programSessions } from "./program-sessions";
import { findProgramSituation, programSituations } from "./program-situations";
import {
  buildPrioritizedSeason,
  findProgramSession,
  mondayOf,
  seasonWeekAt,
  validateSeasonPriorities,
  programSubThemeIds,
  programSubThemes,
  situationMinutes,
  situationToActivity,
  subThemesOf,
  suggestSeasonPriorities,
} from "./season-program";

describe("programmation de saison", () => {
  it("décrit 72 séances dont chaque situation existe", () => {
    expect(programSessions.map((session) => session.number)).toEqual(Array.from({ length: 72 }, (_, i) => i + 1));
    for (const session of programSessions) {
      if (session.type === "evaluation") continue;
      expect(session.situations.length).toBeGreaterThanOrEqual(5);
      for (const id of session.situations) {
        expect(findProgramSituation(id), `${session.number} ${id}`).toBeDefined();
      }
    }
    expect(programSessions.filter((session) => session.type === "evaluation")).toHaveLength(6);
    expect(programSessions.filter((session) => session.type === "recreational")).toHaveLength(6);
  });

  it("range les neuf sous-thèmes sous les cinq thèmes, chacun avec au moins une séance", () => {
    expect(programSubThemeIds).toHaveLength(9);
    for (const theme of developmentThemes) {
      expect(subThemesOf(theme).length, theme).toBeGreaterThan(0);
    }
    for (const id of programSubThemeIds) {
      expect(
        programSessions.some((session) => session.type === "theme" && session.subTheme === id),
        id,
      ).toBe(true);
    }
  });

  it("garde des identifiants uniques et une séance d’environ 75 minutes", () => {
    expect(new Set(programSituations.map((situation) => situation.id)).size).toBe(programSituations.length);
    for (const session of programSessions) {
      if (session.type !== "theme") continue;
      const minutes = session.situations.reduce((sum, id) => sum + situationMinutes(findProgramSituation(id)!), 0);
      expect(minutes, `séance ${session.number}`).toBeGreaterThanOrEqual(55);
      expect(minutes, `séance ${session.number}`).toBeLessThanOrEqual(80);
    }
  });

  it("transforme une situation en exercice de la bibliothèque, schéma compris", () => {
    const activity = situationToActivity(findProgramSituation("cfi-espaces-gardien-cible")!);
    expect(activity.kind).toBe("main");
    expect(activity.compatibleThemes).toEqual(["Conserver le ballon"]);
    expect(activity.diagram.tokens.filter((token) => token.role === "goalkeeper")).toHaveLength(2);
    expect(activity.diagram.marks?.length).toBe(1);
    expect(activity.rules.at(-1)).toMatch(/^Variante : /);
  });

  it("génère une séance pour le nouveau thème Protéger son but", () => {
    const session = generateTrainingSession({ week: 1, phase: "Découvrir", theme: "Protéger son but", intention: "", observable: "" }, "U11", 16);
    expect(session.blocks).toHaveLength(4);
    expect(session.blocks.every((block) => block.activity.id.startsWith("cfi-"))).toBe(true);
  });
});

describe("saison priorisée", () => {
  const count = (weeks: ReturnType<typeof buildPrioritizedSeason>) => weeks.flatMap((week) => week.slots);

  it("remplit 36 semaines avec le nombre de séances hebdomadaires", () => {
    for (const perWeek of [1, 2, 3]) {
      const season = buildPrioritizedSeason({ priorities: ["Finir les actions"], sessionsPerWeek: perWeek });
      expect(season).toHaveLength(36);
      expect(season.every((week) => week.slots.length === perWeek)).toBe(true);
    }
  });

  it("place les évaluations en début, milieu et fin de saison", () => {
    const season = buildPrioritizedSeason({ priorities: [], sessionsPerWeek: 2 });
    const weeksOf = (type: string) =>
      count(season)
        .filter((slot) => slot.type === type)
        .map((slot) => slot.week);
    expect(weeksOf("evaluation")).toEqual([1, 1, 19, 19, 36, 36]);
    expect(weeksOf("recreational")).toHaveLength(6);
  });

  it("donne environ 60 % des séances à thème aux priorités, sans oublier les autres sous-thèmes", () => {
    const slots = count(buildPrioritizedSeason({ priorities: ["Protéger son but", "Conserver le ballon"], sessionsPerWeek: 2 })).filter(
      (slot) => slot.type === "theme",
    );
    const major = slots.filter((slot) => slot.major).length;
    expect(major / slots.length).toBeGreaterThan(0.5);
    expect(major / slots.length).toBeLessThan(0.7);
    for (const id of programSubThemeIds) {
      expect(slots.filter((slot) => slot.subTheme === id).length, id).toBeGreaterThanOrEqual(2);
    }
    expect(
      slots.filter((slot) => slot.major).every((slot) => ["Protéger son but", "Conserver le ballon"].includes(programSubThemes[slot.subTheme!].theme)),
    ).toBe(true);
  });

  it("alterne avec et sans ballon et ne laisse pas les priorités de côté trop longtemps", () => {
    const season = buildPrioritizedSeason({ priorities: ["Finir les actions"], sessionsPerWeek: 2 });
    const weeksWithMajor = season.filter((week) => week.slots.some((slot) => slot.major)).map((week) => week.week);
    for (let i = 1; i < weeksWithMajor.length; i += 1) {
      expect(weeksWithMajor[i]! - weeksWithMajor[i - 1]!).toBeLessThanOrEqual(4);
    }
    const phases = count(season)
      .filter((slot) => slot.subTheme)
      .map((slot) => programSubThemes[slot.subTheme!].phase);
    expect(new Set(phases).size).toBe(2);
  });

  it("est déterministe et ne renvoie que des séances existantes", () => {
    const a = buildPrioritizedSeason({ priorities: ["Récupérer rapidement"], sessionsPerWeek: 2 });
    const b = buildPrioritizedSeason({ priorities: ["Récupérer rapidement"], sessionsPerWeek: 2 });
    expect(a).toEqual(b);
    expect(count(a).every((slot) => findProgramSession(slot.sessionNumber))).toBe(true);
  });

  it("propose comme priorités les thèmes les plus faibles du diagnostic", () => {
    expect(
      suggestSeasonPriorities({ priorities: [{ theme: "Récupérer rapidement" }, { theme: "Progresser ensemble" }, { theme: "Finir les actions" }] }),
    ).toEqual(["Récupérer rapidement", "Progresser ensemble"]);
  });
});

describe("saison guidée : priorités et semaine en cours", () => {
  it("valide un ou deux thèmes connus, sans doublon", () => {
    expect(validateSeasonPriorities(["Finir les actions"])).toEqual(["Finir les actions"]);
    expect(() => validateSeasonPriorities([])).toThrow("Choisis un ou deux thèmes prioritaires.");
    expect(() => validateSeasonPriorities(["Finir les actions", "Finir les actions"])).toThrow("Thème prioritaire inconnu.");
    expect(() => validateSeasonPriorities(["Défendre"])).toThrow("Thème prioritaire inconnu.");
    expect(() => validateSeasonPriorities("Finir les actions")).toThrow();
  });

  it("compte les semaines depuis le lundi de départ, bornées à la saison", () => {
    const start = new Date(2026, 8, 9);
    expect(mondayOf(start)).toEqual(new Date(2026, 8, 7));
    expect(seasonWeekAt(start, new Date(2026, 8, 13))).toBe(1);
    expect(seasonWeekAt(start, new Date(2026, 8, 14))).toBe(2);
    expect(seasonWeekAt(start, new Date(2026, 7, 1))).toBe(1);
    expect(seasonWeekAt(start, new Date(2027, 11, 1))).toBe(36);
  });
});
