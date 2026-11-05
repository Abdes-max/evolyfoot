import { describe, expect, it } from "vitest";
import { createAttendanceEntry } from "./attendance";
import { convocationDue, convocationSendDate, isValidLeadDays, summarizeTrainingResponses } from "./training-convocation";

const meeting = new Date("2026-11-12T18:00:00Z");

describe("convocationDue", () => {
  it("part N jours avant le rendez-vous", () => {
    expect(convocationDue(meeting, 2, new Date("2026-11-10T17:59:00Z"))).toBe(false);
    expect(convocationDue(meeting, 2, new Date("2026-11-10T18:00:00Z"))).toBe(true);
  });

  it("part tout de suite avec « dès la création », jamais en envoi manuel ni après la séance", () => {
    expect(convocationDue(meeting, 0, new Date("2026-11-01T08:00:00Z"))).toBe(true);
    expect(convocationDue(meeting, null, new Date("2026-11-12T08:00:00Z"))).toBe(false);
    expect(convocationDue(meeting, 1, new Date("2026-11-12T19:00:00Z"))).toBe(false);
  });

  it("donne la date d'envoi prévue", () => {
    expect(convocationSendDate(meeting, 1)?.toISOString()).toBe("2026-11-11T18:00:00.000Z");
    expect(convocationSendDate(meeting, 0)).toBeNull();
  });

  it("n'accepte que les délais proposés", () => {
    expect(isValidLeadDays(2)).toBe(true);
    expect(isValidLeadDays(null)).toBe(true);
    expect(isValidLeadDays(5)).toBe(false);
  });
});

describe("summarizeTrainingResponses", () => {
  it("range l'effectif en présents, absents et sans réponse", () => {
    const roster = [
      { id: "a", name: "Ali" },
      { id: "b", name: "Bilal" },
      { id: "c", name: "Chris" },
    ];
    const responses = summarizeTrainingResponses(roster, [
      createAttendanceEntry("a", "Ali", "present"),
      createAttendanceEntry("b", "Bilal", "sick", "Grippe"),
      createAttendanceEntry("z", "Parti", "present"),
    ]);
    expect(responses.present.map((entry) => entry.playerId)).toEqual(["a"]);
    expect(responses.absent.map((entry) => entry.comment)).toEqual(["Grippe"]);
    expect(responses.pending).toEqual([{ id: "c", name: "Chris" }]);
  });
});
