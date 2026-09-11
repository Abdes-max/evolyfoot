import { describe, expect, it } from "vitest";
import { attendanceStatusOf, createAttendanceEntry, summarizeAttendance } from "./attendance";

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

describe("createAttendanceEntry", () => {
  it("dérive present à partir du statut : présent et en retard comptent comme présent", () => {
    expect(createAttendanceEntry("1", "Lina", "present").present).toBe(true);
    expect(createAttendanceEntry("1", "Lina", "late").present).toBe(true);
  });

  it("malade, blessé, raison personnelle et absent comptent comme absent", () => {
    for (const status of ["sick", "injured", "personal", "absent"] as const) {
      expect(createAttendanceEntry("1", "Lina", status).present).toBe(false);
    }
  });

  it("conserve le statut détaillé sur l'entrée", () => {
    expect(createAttendanceEntry("1", "Lina", "sick").status).toBe("sick");
  });
});

describe("attendanceStatusOf", () => {
  it("renvoie le statut explicite quand il est présent", () => {
    expect(attendanceStatusOf({ present: true, status: "late" })).toBe("late");
  });

  it("retombe sur présent/absent pour une entrée sans statut détaillé", () => {
    expect(attendanceStatusOf({ present: true })).toBe("present");
    expect(attendanceStatusOf({ present: false })).toBe("absent");
  });
});
