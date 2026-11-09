import { describe, expect, it } from "vitest";
import { isPastMatch, matchesInScope } from "./match-scope";

const now = new Date("2026-11-10T12:00:00.000Z").getTime();
const hour = 3600_000;
const at = (offsetHours: number) => new Date(now + offsetHours * hour).toISOString();

const matches = [
  { id: "demain", status: "scheduled" as const, date: at(24) },
  { id: "dans-une-semaine", status: "scheduled" as const, date: at(24 * 7) },
  { id: "sans-date", status: "scheduled" as const, date: null },
  { id: "en-cours", status: "scheduled" as const, date: at(-1) },
  { id: "oublie", status: "scheduled" as const, date: at(-48) },
  { id: "joue-hier", status: "played" as const, date: at(-24) },
  { id: "joue-il-y-a-un-mois", status: "played" as const, date: at(-24 * 30) },
  { id: "joue-sans-date", status: "played" as const, date: null },
];

describe("filtre à venir / passés des matchs", () => {
  it("un match joué est passé, un match commencé depuis moins de 3 h reste à venir", () => {
    expect(isPastMatch({ status: "played", date: at(24) }, now)).toBe(true);
    expect(isPastMatch({ status: "scheduled", date: at(-2) }, now)).toBe(false);
    expect(isPastMatch({ status: "scheduled", date: at(-4) }, now)).toBe(true);
    expect(isPastMatch({ status: "scheduled", date: null }, now)).toBe(false);
  });

  it("à venir : les plus proches d'abord, ceux sans date à la fin", () => {
    expect(matchesInScope(matches, "upcoming", now).map((match) => match.id)).toEqual(["en-cours", "demain", "dans-une-semaine", "sans-date"]);
  });

  it("passés : les plus récents d'abord, ceux sans date à la fin, sans modifier la liste d'origine", () => {
    const before = matches.map((match) => match.id);
    expect(matchesInScope(matches, "past", now).map((match) => match.id)).toEqual(["joue-hier", "oublie", "joue-il-y-a-un-mois", "joue-sans-date"]);
    expect(matches.map((match) => match.id)).toEqual(before);
  });
});
