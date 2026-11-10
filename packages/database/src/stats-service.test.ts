import { describe, expect, it } from "vitest";
import { StatsService } from "./stats-service";

const entry = (playerId: string, present: boolean) => ({ playerId, playerName: playerId, present, status: present ? "present" : "absent" }) as never;
const cancelledAt = new Date("2026-11-10T10:00:00.000Z");

function setup() {
  const sessions = [
    { id: "s1", cancelledAt: null, attendance: [entry("a", true), entry("b", false)] },
    { id: "s2", cancelledAt, attendance: [entry("a", false), entry("b", false)] },
  ];
  const matches = [
    { id: "m1", status: "played", cancelledAt: null, attendance: [entry("a", true)] },
    { id: "m2", status: "scheduled", cancelledAt, attendance: [entry("a", false)] },
    { id: "m3", status: "scheduled", cancelledAt: null, attendance: [] },
  ];
  const tournaments = [
    { id: "t1", cancelledAt: null },
    { id: "t2", cancelledAt },
  ];
  const plateaux = [{ id: "p1", cancelledAt }];
  return new StatsService(
    { listByEducator: async () => sessions } as never,
    { listByEducator: async () => matches } as never,
    { listByEducator: async () => tournaments } as never,
    { listByEducator: async () => plateaux } as never,
  );
}

describe("StatsService", () => {
  it("exclut les événements annulés des totaux et des taux de présence", async () => {
    const stats = await setup().get("coach-1");

    expect(stats).toMatchObject({ trainingCount: 1, matchCount: 2, matchesPlayed: 1, matchesScheduled: 1, tournamentCount: 1, plateauCount: 0 });
    // Séance annulée (2 absents) et match annulé (1 absent) ignorés : 1 présent sur 2 à l'entraînement, 1 sur 1 en match.
    expect(stats.trainingAttendance).toMatchObject({ total: 2, rate: 50 });
    expect(stats.matchAttendance).toMatchObject({ total: 1, rate: 100 });
  });
});
