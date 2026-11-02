import { describe, expect, it } from "vitest";
import { buildSeasonCalendar, seasonLabel, seasonStartDate, seasonStartYear } from "./season";

describe("buildSeasonCalendar", () => {
  const now = new Date(2026, 10, 1);

  it("couvre août à juin de la saison en cours", () => {
    const calendar = buildSeasonCalendar([], now);

    expect(calendar.label).toBe("Saison 2026-2027");
    expect(calendar.months).toHaveLength(11);
    expect(calendar.months[0]).toMatchObject({ year: 2026, month: 7 });
    expect(calendar.months[10]).toMatchObject({ year: 2027, month: 5 });
    expect(calendar.months.filter((month) => month.isCurrent).map((month) => month.month)).toEqual([10]);
  });

  it("change de saison en juillet, pas avant", () => {
    expect(seasonStartYear(new Date(2027, 5, 30))).toBe(2026);
    expect(seasonStartYear(new Date(2027, 6, 1))).toBe(2027);
  });

  it("range les événements par mois, dans l'ordre, et compte ceux sans date", () => {
    const calendar = buildSeasonCalendar(
      [
        { id: "b", type: "match", title: "Match", date: new Date(2026, 10, 20).toISOString() },
        { id: "a", type: "session", title: "Séance", date: new Date(2026, 10, 5).toISOString() },
        { id: "c", type: "plateau", title: "Plateau", date: null },
        { id: "d", type: "tournament", title: "Hors saison", date: new Date(2025, 10, 5).toISOString() },
      ],
      now,
    );

    expect(calendar.months[3]?.events.map((event) => event.id)).toEqual(["a", "b"]);
    expect(calendar.undatedCount).toBe(1);
  });

  it("fait commencer la saison le 1er juillet, comme seasonStartYear", () => {
    expect(seasonStartDate(new Date(2027, 5, 30))).toEqual(new Date(2026, 6, 1));
    expect(seasonStartDate(new Date(2027, 6, 1))).toEqual(new Date(2027, 6, 1));
    expect(seasonLabel(2027)).toBe("2027-2028");
  });
});
