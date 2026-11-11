import { describe, expect, it } from "vitest";
import { isPastSeasonSlot, isPastSession, seasonSessionStatus, seasonSessionStatusLabels, sessionsInScope } from "./session-scope";

const now = new Date("2026-11-10T12:00:00.000Z").getTime();
const hours = (count: number) => new Date(now + count * 3600_000).toISOString();

describe("filtre À venir / Passées des séances", () => {
  it("garde une séance commencée il y a moins de 3 h à venir ; une séance sans date n'est jamais passée", () => {
    expect(isPastSession(hours(-2), now)).toBe(false);
    expect(isPastSession(hours(-4), now)).toBe(true);
    expect(isPastSession(hours(5), now)).toBe(false);
    expect(isPastSession(null, now)).toBe(false);
  });

  it("trie les séances datées : les plus proches d'abord à venir, les plus récentes d'abord passées", () => {
    const sessions = [
      { id: "a", meetingAt: hours(48) },
      { id: "b", meetingAt: hours(-48) },
      { id: "c", meetingAt: hours(24) },
      { id: "d", meetingAt: hours(-72) },
      { id: "e", meetingAt: null },
    ];
    expect(sessionsInScope(sessions, "upcoming", now).map((session) => session.id)).toEqual(["c", "a"]);
    expect(sessionsInScope(sessions, "past", now).map((session) => session.id)).toEqual(["b", "d"]);
  });

  it("date un créneau de la saison par sa séance préparée, son jour d'entraînement, ou sa semaine", () => {
    const base = { startDate: "2026-09-07", slot: 0, trainingDays: ["Mardi" as const], currentWeek: 10, now };
    expect(isPastSeasonSlot({ ...base, week: 9, meetingAt: hours(24) })).toBe(false);
    expect(isPastSeasonSlot({ ...base, week: 9 })).toBe(true);
    expect(isPastSeasonSlot({ ...base, week: 30 })).toBe(false);
    expect(isPastSeasonSlot({ ...base, startDate: null, trainingDays: [], week: 9 })).toBe(true);
    expect(isPastSeasonSlot({ ...base, startDate: null, trainingDays: [], week: 10 })).toBe(false);
  });
});

describe("statut d'une séance de la saison", () => {
  it("est à préparer sans séance, préparée tant qu'elle n'a pas eu lieu, terminée ensuite", () => {
    expect(seasonSessionStatus(null, now)).toBe("toPrepare");
    expect(seasonSessionStatus({ meetingAt: hours(24) }, now)).toBe("prepared");
    expect(seasonSessionStatus({ meetingAt: null }, now)).toBe("prepared");
    expect(seasonSessionStatus({ meetingAt: hours(-48) }, now)).toBe("done");
    expect(seasonSessionStatusLabels).toEqual({ toPrepare: "À préparer", prepared: "Préparée", done: "Terminée" });
  });
});
