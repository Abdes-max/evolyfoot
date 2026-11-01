import { describe, expect, it } from "vitest";
import { buildSeasonPlan } from "./season-plan";

const scores = { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 };

describe("plan de saison", () => {
  it("commence par le cycle en cours et la priorité la plus fragile", () => {
    const [first, second] = buildSeasonPlan(scores, 2, 1, new Date(2026, 10, 4));

    expect(first).toMatchObject({ number: 2, theme: "Récupérer rapidement", current: true });
    expect(first?.start).toEqual(new Date(2026, 10, 2));
    expect(first?.end).toEqual(new Date(2026, 10, 29));
    expect(second?.number).toBe(3);
    expect(second?.current).toBe(false);
    expect(second?.theme).toBe(first?.supportTheme);
  });

  it("passe par chaque thème une fois par tour", () => {
    const themes = buildSeasonPlan(scores, 1, 1, new Date(2026, 8, 7)).slice(0, 4).map((cycle) => cycle.theme);

    expect(new Set(themes).size).toBe(4);
  });

  it("recule au début du cycle selon la semaine en cours", () => {
    const [first] = buildSeasonPlan(scores, 1, 3, new Date(2026, 10, 18));

    expect(first?.start).toEqual(new Date(2026, 10, 2));
  });

  it("s'arrête à la fin de la saison et fait évoluer l'intention au fil des passages", () => {
    const cycles = buildSeasonPlan(scores, 1, 1, new Date(2026, 8, 7));

    expect(cycles.at(-1)!.start.getTime()).toBeLessThan(new Date(2027, 5, 30).getTime());
    expect(cycles[0]?.intent).toBe("Découvrir et installer");
    expect(cycles[4]?.intent).toBe("Renforcer sous pression");
    expect(cycles[4]?.theme).toBe(cycles[0]?.theme);
    expect(cycles[8]?.intent).toBe("Confirmer en match");
  });

  it("garde le cycle en cours même en toute fin de saison", () => {
    const cycles = buildSeasonPlan(scores, 9, 4, new Date(2027, 5, 24));

    expect(cycles[0]?.current).toBe(true);
  });
});
