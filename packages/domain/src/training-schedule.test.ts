import { describe, expect, it } from "vitest";
import { parseTrainingSchedule, scheduleForSlot } from "./training-schedule";

describe("créneaux récurrents", () => {
  it("lit les créneaux d'un formulaire", () => {
    expect(parseTrainingSchedule(undefined)).toBeUndefined();
    expect(
      parseTrainingSchedule([
        { day: "Lundi", time: "12:00", location: " Aix " },
        { day: "Mercredi", time: "16:00" },
      ]),
    ).toEqual([
      { day: "Lundi", time: "12:00", location: "Aix" },
      { day: "Mercredi", time: "16:00", location: "" },
    ]);
  });

  it("refuse un jour inconnu ou en double, une heure mal écrite", () => {
    expect(() => parseTrainingSchedule([{ day: "Dimanche", time: "10:00" }])).toThrow("Jour");
    expect(() =>
      parseTrainingSchedule([
        { day: "Lundi", time: "10:00" },
        { day: "Lundi", time: "11:00" },
      ]),
    ).toThrow("Jour");
    expect(() => parseTrainingSchedule([{ day: "Lundi", time: "25:00" }])).toThrow("Heure");
  });

  it("donne l'heure et le lieu du créneau d'une séance, 18:00 sans réglage", () => {
    const schedule = [
      { day: "Mercredi" as const, time: "16:00", location: "Marseille" },
      { day: "Lundi" as const, time: "12:00", location: "Aix" },
    ];
    expect(scheduleForSlot(schedule, ["Mercredi", "Lundi"], 0)).toEqual({ time: "12:00", location: "Aix" });
    expect(scheduleForSlot(schedule, ["Mercredi", "Lundi"], 1)).toEqual({ time: "16:00", location: "Marseille" });
    expect(scheduleForSlot(null, ["Mardi"], 0)).toEqual({ time: "18:00", location: "" });
  });
});
