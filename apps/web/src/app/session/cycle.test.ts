import { describe, expect, it } from "vitest";
import { suggestedMeetingAt } from "./cycle";

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
