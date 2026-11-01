import { describe, expect, it } from "vitest";
import { fixtureFromTitle, parseCalendarFile } from "./calendar-import";

const file = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "SUMMARY:FC Horizon - US Vallée",
  "DTSTART:20261107T140000Z",
  "LOCATION:Stade Marius Requier\\, Aix-en-Provence",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261114",
  "SUMMARY:AS Plaine contre FC Ho",
  " rizon",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261121T150000",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("lecture d'un calendrier .ics", () => {
  it("lit le titre, la date et le lieu, et ignore un événement sans titre", () => {
    const events = parseCalendarFile(file);

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      title: "FC Horizon - US Vallée",
      date: new Date("2026-11-07T14:00:00.000Z"),
      location: "Stade Marius Requier, Aix-en-Provence",
    });
  });

  it("recolle une ligne repliée et accepte une journée entière", () => {
    const [, second] = parseCalendarFile(file);

    expect(second?.title).toBe("AS Plaine contre FC Horizon");
    expect(second?.date?.getDate()).toBe(14);
    expect(second?.location).toBeNull();
  });

  it("garde l'événement si sa date est illisible", () => {
    const [event] = parseCalendarFile("BEGIN:VEVENT\nSUMMARY:Match\nDTSTART:demain\nEND:VEVENT");

    expect(event).toEqual({ title: "Match", date: null, location: null });
  });

  it("ne lit rien dans un fichier sans événement", () => {
    expect(parseCalendarFile("pas un calendrier")).toEqual([]);
  });

  it("limite le nombre d'événements lus", () => {
    const events = "BEGIN:VEVENT\nSUMMARY:Match\nEND:VEVENT\n".repeat(300);

    expect(parseCalendarFile(events)).toHaveLength(200);
  });
});

describe("adversaire déduit du titre", () => {
  it("trouve l'autre équipe et le lieu du match", () => {
    expect(fixtureFromTitle("FC Horizon - US Vallée", "FC Horizon")).toEqual({ opponent: "US Vallée", venue: "home" });
    expect(fixtureFromTitle("US Vallée vs FC Horizon", "FC Horizon")).toEqual({ opponent: "US Vallée", venue: "away" });
  });

  it("ignore les accents et la casse", () => {
    expect(fixtureFromTitle("U.S. Vallée – ÉTOILE SPORTIVE", "Etoile sportive")).toEqual({ opponent: "U.S. Vallée", venue: "away" });
  });

  it("garde le titre entier s'il ne reconnaît pas l'équipe", () => {
    expect(fixtureFromTitle("Tournoi de printemps", "FC Horizon")).toEqual({ opponent: "Tournoi de printemps", venue: "home" });
    expect(fixtureFromTitle("Saint-Maur - Créteil", "FC Horizon")).toEqual({ opponent: "Saint-Maur - Créteil", venue: "home" });
  });
});
