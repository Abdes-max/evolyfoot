import { createMatchClock, defaultMatchClockSettings, type MatchClock, type MatchClockSettings } from "@evolyfoot/domain";
import { useCallback, useEffect, useState } from "react";

// Chronomètres en cours, un par match : ils survivent à la navigation dans l'appli (aller voir la
// composition, revenir) mais pas à sa fermeture. Le réglage choisi est repris pour le match suivant.
const clocks = new Map<string, MatchClock>();
let lastSettings: MatchClockSettings = defaultMatchClockSettings;

function read(matchId: string): MatchClock {
  return clocks.get(matchId) ?? createMatchClock(lastSettings);
}

// Chronomètre d'un match et heure courante, relue 4 fois par seconde tant qu'il tourne.
export function useMatchClock(matchId: string): { clock: MatchClock; now: number; update: (next: (clock: MatchClock, now: number) => MatchClock) => void } {
  const [clock, setClock] = useState(() => read(matchId));
  const [now, setNow] = useState(() => Date.now());

  const update = useCallback(
    (next: (clock: MatchClock, now: number) => MatchClock) => {
      const current = Date.now();
      setNow(current);
      setClock((previous) => {
        const updated = next(previous, current);
        clocks.set(matchId, updated);
        if (updated.status === "ready") {
          lastSettings = { periods: updated.periods, minutesPerPeriod: updated.minutesPerPeriod };
        }
        return updated;
      });
    },
    [matchId],
  );

  useEffect(() => {
    if (clock.status !== "running") return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [clock.status]);

  return { clock, now, update };
}
