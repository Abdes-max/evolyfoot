import { describe, expect, it } from "vitest";
import { currentCycleWeek, firstFreeCycleSlot, suggestedMeetingAt } from "./training-calendar";

describe("firstFreeCycleSlot", () => {
  it("renvoie le premier créneau sans séance", () => {
    expect(firstFreeCycleSlot([{ weekNumber: 1, slot: 0 }], 2)).toEqual({ weekNumber: 1, slot: 1 });
  });

  it("renvoie null quand le cycle est complet", () => {
    const sessions = [1, 2, 3, 4].map((weekNumber) => ({ weekNumber, slot: 0 }));

    expect(firstFreeCycleSlot(sessions, 1)).toBeNull();
    expect(currentCycleWeek(sessions, 1)).toBe(4);
  });
});

describe("suggestedMeetingAt", () => {
  // Mardi 3 novembre 2026, 10h (heure locale).
  const now = new Date(2026, 10, 3, 10, 0);

  it("propose le prochain jour d'entraînement à 18h", () => {
    const suggested = new Date(suggestedMeetingAt("Jeudi", 1, 1, now)!);

    expect(suggested.getDate()).toBe(5);
    expect(suggested.getHours()).toBe(18);
  });

  it("passe à la semaine suivante quand le jour est celui d'aujourd'hui", () => {
    expect(new Date(suggestedMeetingAt("Mardi", 1, 1, now)!).getDate()).toBe(10);
  });

  it("décale selon l'écart avec la semaine en cours", () => {
    expect(new Date(suggestedMeetingAt("Jeudi", 3, 1, now)!).getDate()).toBe(19);
  });

  it("ne propose rien sans jour réel", () => {
    expect(suggestedMeetingAt(undefined, 1, 1, now)).toBeNull();
    expect(suggestedMeetingAt("Séance 1", 1, 1, now)).toBeNull();
  });
});
