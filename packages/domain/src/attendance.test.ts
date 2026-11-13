import { describe, expect, it } from "vitest";
import { attendanceStatusOf, buildAttendanceEntries, createAttendanceEntry, mergeAttendance, summarizeAttendance } from "./attendance";

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

describe("buildAttendanceEntries", () => {
  const players = [
    { id: "a", name: "Yanis Martin" },
    { id: "b", name: "Lina Dupont" },
  ];

  it("crée les entrées avec le nom de l'effectif et compte le retard comme présent", () => {
    const entries = buildAttendanceEntries(
      [
        { playerId: "a", status: "late", comment: "Bus en retard" },
        { playerId: "b", status: "sick", comment: "  Grippe  ", playerName: "<b>Zorro</b>" },
      ],
      players,
    );
    expect(entries.map((entry) => [entry.playerName, entry.status, entry.present, entry.comment])).toEqual([
      ["Yanis Martin", "late", true, "Bus en retard"],
      ["Lina Dupont", "sick", false, "Grippe"],
    ]);
  });

  it("n'enregistre pas de commentaire pour un joueur présent", () => {
    const [entry] = buildAttendanceEntries([{ playerId: "a", status: "present", comment: "ok" }], players);
    expect(entry?.comment).toBeNull();
  });

  it.each([
    [[], /au moins un joueur/],
    ["texte", /au moins un joueur/],
    [[{ playerId: "zzz", status: "present" }], /ne fait pas partie/],
    [
      [
        { playerId: "a", status: "present" },
        { playerId: "a", status: "absent" },
      ],
      /deux fois/,
    ],
    [[{ playerId: "a", status: "dormeur" }], /Statut de présence inconnu/],
    [[{ playerId: "a", status: "absent", comment: "x".repeat(201) }], /trop long/],
  ])("refuse %j", (updates, message) => {
    expect(() => buildAttendanceEntries(updates, players)).toThrow(message);
  });
});

describe("mergeAttendance", () => {
  it("remplace les joueurs corrigés et garde les autres", () => {
    const existing = [createAttendanceEntry("a", "Yanis", "absent", "malade"), createAttendanceEntry("b", "Lina", "present")];
    const merged = mergeAttendance(existing, [createAttendanceEntry("a", "Yanis", "late")]);
    expect(merged.map((entry) => [entry.playerId, entry.status])).toEqual([
      ["b", "present"],
      ["a", "late"],
    ]);
  });
});
