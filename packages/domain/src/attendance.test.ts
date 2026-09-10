import { describe, expect, it } from "vitest";
import { summarizeAttendance } from "./attendance";

describe("attendance", () => {
  it("calcule le taux de présence", () => {
    const summary = summarizeAttendance([
      { playerId: "1", playerName: "Lina", present: true },
      { playerId: "2", playerName: "Noah", present: true },
      { playerId: "3", playerName: "Sami", present: false },
      { playerId: "4", playerName: "Ines", present: true },
    ]);
    expect(summary).toEqual({ present: 3, absent: 1, total: 4, rate: 75 });
  });

  it("renvoie un taux de 0 pour une liste vide", () => {
    expect(summarizeAttendance([])).toEqual({ present: 0, absent: 0, total: 0, rate: 0 });
  });
});
