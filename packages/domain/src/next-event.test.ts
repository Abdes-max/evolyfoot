import { describe, expect, it } from "vitest";
import { nextEvent } from "./next-event";

describe("prochain match ou compétition", () => {
  const now = new Date("2026-11-14T15:00:00Z");

  it("prend le plus proche entre matchs, tournois et plateaux, y compris un tournoi du jour", () => {
    const events = [
      { kind: "match" as const, id: "m", date: "2026-11-21T10:00:00Z", open: true },
      { kind: "tournament" as const, id: "t", date: "2026-11-14T00:00:00.000Z", open: true },
      { kind: "plateau" as const, id: "p", date: "2026-11-15T00:00:00.000Z", open: true },
    ];
    expect(nextEvent(events, now)?.id).toBe("t");
  });

  it("ignore ce qui est passé, terminé ou annulé ; un match sans date vient en dernier", () => {
    const events = [
      { kind: "plateau" as const, id: "passé", date: "2026-11-13T00:00:00.000Z", open: true },
      { kind: "tournament" as const, id: "terminé", date: "2026-11-20T00:00:00.000Z", open: false },
      { kind: "match" as const, id: "sans-date", date: null, open: true },
      { kind: "match" as const, id: "daté", date: "2026-12-01T10:00:00Z", open: true },
    ];
    expect(nextEvent(events, now)?.id).toBe("daté");
    expect(nextEvent(events.slice(0, 3), now)?.id).toBe("sans-date");
    expect(nextEvent(events.slice(0, 2), now)).toBeNull();
  });
});
