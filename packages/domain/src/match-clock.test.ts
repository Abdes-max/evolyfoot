import { describe, expect, it } from "vitest";
import {
  createMatchClock,
  endMatchPeriod,
  formatClock,
  isPeriodOver,
  isValidMatchClockSettings,
  matchPlayedSeconds,
  pauseMatchClock,
  periodElapsed,
  readMatchClock,
  resetMatchClock,
  startMatchClock,
} from "./match-clock";

const t0 = 1_000_000;
const second = 1000;

describe("chronomètre de match", () => {
  it("compte à partir des horodatages, même si l'écran a dormi", () => {
    const running = startMatchClock(createMatchClock({ periods: 2, minutesPerPeriod: 25 }), t0);
    expect(periodElapsed(running, t0)).toBe(0);
    // 10 minutes plus tard, sans aucun « tick » entre-temps.
    expect(periodElapsed(running, t0 + 600 * second)).toBe(600);
  });

  it("garde le temps joué pendant une pause et le reprend", () => {
    let clock = startMatchClock(createMatchClock(), t0);
    clock = pauseMatchClock(clock, t0 + 120 * second);
    expect(clock.status).toBe("paused");
    // La pause ne compte pas.
    expect(periodElapsed(clock, t0 + 900 * second)).toBe(120);
    clock = startMatchClock(clock, t0 + 900 * second);
    expect(periodElapsed(clock, t0 + 960 * second)).toBe(180);
  });

  it("passe par la mi-temps, puis la seconde période repart de zéro", () => {
    let clock = startMatchClock(createMatchClock({ periods: 2, minutesPerPeriod: 25 }), t0);
    clock = endMatchPeriod(clock, t0 + 1500 * second);
    expect(clock.status).toBe("halftime");
    expect(clock.completedSeconds).toBe(1500);
    expect(periodElapsed(clock, t0 + 5000 * second)).toBe(0);

    clock = startMatchClock(clock, t0 + 2400 * second);
    expect(clock.period).toBe(2);
    expect(readMatchClock(clock, t0 + 2400 * second + 90 * second)).toMatchObject({ main: "1:30", periodLabel: "2e mi-temps", total: "26:30" });

    clock = endMatchPeriod(clock, t0 + 2400 * second + 1500 * second);
    expect(clock.status).toBe("finished");
    expect(matchPlayedSeconds(clock, t0 + 99_999 * second)).toBe(3000);
  });

  it("un match d'une seule période finit directement", () => {
    const clock = endMatchPeriod(startMatchClock(createMatchClock({ periods: 1, minutesPerPeriod: 40 }), t0), t0 + 2400 * second);
    expect(clock.status).toBe("finished");
    expect(readMatchClock(clock, t0).periodLabel).toBe("Match");
  });

  it("affiche le temps additionnel et prévient quand la période est atteinte", () => {
    const clock = startMatchClock(createMatchClock({ periods: 2, minutesPerPeriod: 25 }), t0);
    expect(isPeriodOver(clock, t0 + 1499 * second)).toBe(false);
    expect(isPeriodOver(clock, t0 + 1500 * second)).toBe(true);
    expect(readMatchClock(clock, t0 + 1572 * second)).toMatchObject({ main: "25:00", added: "+1:12", target: "25:00" });
    expect(readMatchClock(clock, t0 + 60 * second).added).toBeNull();
  });

  it("ignore les actions impossibles et se réinitialise", () => {
    const ready = createMatchClock();
    expect(pauseMatchClock(ready, t0)).toBe(ready);
    expect(endMatchPeriod(ready, t0)).toBe(ready);
    const finished = endMatchPeriod(startMatchClock(createMatchClock({ periods: 1, minutesPerPeriod: 25 }), t0), t0 + 60 * second);
    expect(finished.status).toBe("finished");
    expect(startMatchClock(finished, t0 + 70 * second)).toBe(finished);
    expect(resetMatchClock(finished)).toEqual(createMatchClock({ periods: 1, minutesPerPeriod: 25 }));
  });

  it("valide les réglages et formate les durées", () => {
    expect(isValidMatchClockSettings({ periods: 2, minutesPerPeriod: 25 })).toBe(true);
    expect(isValidMatchClockSettings({ periods: 3, minutesPerPeriod: 25 })).toBe(false);
    expect(isValidMatchClockSettings({ periods: 1, minutesPerPeriod: 0 })).toBe(false);
    expect(isValidMatchClockSettings({ periods: 1, minutesPerPeriod: 12.5 })).toBe(false);
    expect(isValidMatchClockSettings(null)).toBe(false);
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(754)).toBe("12:34");
    expect(formatClock(-5)).toBe("0:00");
  });
});
