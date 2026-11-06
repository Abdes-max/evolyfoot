import { describe, expect, it } from "vitest";
import { nextSeasonSlot, seasonCycleAsPlan, seasonCycleAt, seasonCycles } from "./season-cycle";
import { buildPrioritizedSeason, programSubThemes } from "./season-program";

describe("cycles de la saison", () => {
  const season = buildPrioritizedSeason({ priorities: ["Protéger son but"], sessionsPerWeek: 2 });
  const cycles = seasonCycles(season);

  it("découpe les 36 semaines en 9 cycles de 4 semaines qui reprennent les séances de la saison", () => {
    expect(cycles).toHaveLength(9);
    expect(cycles.every((cycle) => cycle.weeks.length === 4)).toBe(true);
    expect(cycles.flatMap((cycle) => cycle.weeks.flatMap((week) => week.slots))).toEqual(season.flatMap((week) => week.slots));
    expect(cycles[1]!.weeks.map((week) => [week.seasonWeek, week.weekInCycle, week.phase])).toEqual([
      [5, 1, "Découvrir"],
      [6, 2, "Stabiliser"],
      [7, 3, "Mettre sous pression"],
      [8, 4, "Évaluer"],
    ]);
  });

  it("donne à chaque cycle le thème dominant de ses séances, la priorité revenant souvent", () => {
    for (const cycle of cycles) {
      const themes = cycle.weeks.flatMap((week) => week.slots.flatMap((slot) => (slot.subTheme ? [programSubThemes[slot.subTheme].theme] : [])));
      if (themes.length > 0) expect(themes).toContain(cycle.theme);
    }
    expect(cycles.filter((cycle) => cycle.theme === "Protéger son but").length).toBeGreaterThanOrEqual(3);
  });

  it("retrouve le cycle d'une semaine et le présente comme un plan de 4 semaines", () => {
    expect(seasonCycleAt(cycles, 10)?.number).toBe(3);
    expect(seasonCycleAt(cycles, 99)?.number).toBe(9);
    const plan = seasonCycleAsPlan(cycles[2]!);
    expect(plan.title).toMatch(/^Cycle 3\/9 · /);
    expect(plan.weeks.map((week) => week.week)).toEqual([1, 2, 3, 4]);
    expect(plan.explanation).toContain("Semaines 9 à 12");
  });

  it("propose la prochaine séance de la saison à préparer", () => {
    expect(nextSeasonSlot(season, [], 3)).toMatchObject({ week: 3, index: 0 });
    expect(nextSeasonSlot(season, [{ weekNumber: 3, slot: 0 }], 3)).toMatchObject({ week: 3, index: 1 });
    expect(nextSeasonSlot(season, [], 99)).toBeNull();
  });
});
