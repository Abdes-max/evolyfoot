// Chronomètre d'un match, facultatif : une ou deux périodes (mi-temps) d'une durée choisie. L'état ne
// stocke que des horodatages et des cumuls : l'heure affichée se recalcule à chaque lecture, donc elle
// reste juste même si l'écran s'est mis en veille ou l'appli est passée en arrière-plan (un compteur
// décrémenté chaque seconde dériverait).
export type MatchClockStatus = "ready" | "running" | "paused" | "halftime" | "finished";

export interface MatchClockSettings {
  // 1 : match d'une seule période ; 2 : deux mi-temps.
  readonly periods: 1 | 2;
  readonly minutesPerPeriod: number;
}

export interface MatchClock extends MatchClockSettings {
  readonly status: MatchClockStatus;
  // Période en cours (1 ou 2).
  readonly period: number;
  // Secondes jouées dans les périodes terminées.
  readonly completedSeconds: number;
  // Secondes jouées dans la période en cours avant le dernier démarrage.
  readonly periodSeconds: number;
  // Horodatage (ms) du dernier démarrage, `null` hors période en cours.
  readonly startedAt: number | null;
}

export const defaultMatchClockSettings: MatchClockSettings = { periods: 2, minutesPerPeriod: 25 };
export const matchClockMinutesRange = { min: 1, max: 60 } as const;

export function isValidMatchClockSettings(value: unknown): value is MatchClockSettings {
  if (typeof value !== "object" || value === null) return false;
  const { periods, minutesPerPeriod } = value as Partial<MatchClockSettings>;
  return (
    (periods === 1 || periods === 2) &&
    typeof minutesPerPeriod === "number" &&
    Number.isInteger(minutesPerPeriod) &&
    minutesPerPeriod >= matchClockMinutesRange.min &&
    minutesPerPeriod <= matchClockMinutesRange.max
  );
}

export function createMatchClock(settings: MatchClockSettings = defaultMatchClockSettings): MatchClock {
  return { ...settings, status: "ready", period: 1, completedSeconds: 0, periodSeconds: 0, startedAt: null };
}

// Secondes jouées dans la période en cours.
export function periodElapsed(clock: MatchClock, now: number): number {
  const running = clock.status === "running" && clock.startedAt !== null ? Math.max(0, now - clock.startedAt) / 1000 : 0;
  return Math.floor(clock.periodSeconds + running);
}

// Temps de jeu total du match, toutes périodes confondues.
export function matchPlayedSeconds(clock: MatchClock, now: number): number {
  return clock.completedSeconds + periodElapsed(clock, now);
}

// Démarre, reprend après une pause, ou lance la période suivante après la mi-temps.
export function startMatchClock(clock: MatchClock, now: number): MatchClock {
  if (clock.status === "ready" || clock.status === "paused") {
    return { ...clock, status: "running", startedAt: now };
  }
  if (clock.status === "halftime") {
    return { ...clock, status: "running", period: clock.period + 1, periodSeconds: 0, startedAt: now };
  }
  return clock;
}

export function pauseMatchClock(clock: MatchClock, now: number): MatchClock {
  if (clock.status !== "running") return clock;
  return { ...clock, status: "paused", periodSeconds: periodElapsed(clock, now), startedAt: null };
}

// Termine la période en cours : mi-temps s'il en reste une, sinon fin du match.
export function endMatchPeriod(clock: MatchClock, now: number): MatchClock {
  if (clock.status === "ready" || clock.status === "halftime" || clock.status === "finished") return clock;
  const played = periodElapsed(clock, now);
  return {
    ...clock,
    status: clock.period < clock.periods ? "halftime" : "finished",
    completedSeconds: clock.completedSeconds + played,
    periodSeconds: 0,
    startedAt: null,
  };
}

export function resetMatchClock(clock: MatchClock): MatchClock {
  return createMatchClock({ periods: clock.periods, minutesPerPeriod: clock.minutesPerPeriod });
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export interface MatchClockReading {
  // Temps de la période en cours, « 12:34 ».
  readonly main: string;
  // Temps additionnel une fois la durée de la période dépassée, « +1:12 » ; `null` sinon.
  readonly added: string | null;
  // Durée prévue de la période, « 25:00 ».
  readonly target: string;
  // « 1re mi-temps », « 2e mi-temps » ou « Match » pour un match d'une seule période.
  readonly periodLabel: string;
  readonly total: string;
}

export function matchPeriodLabel(clock: Pick<MatchClock, "periods" | "period">): string {
  if (clock.periods === 1) return "Match";
  return clock.period === 1 ? "1re mi-temps" : "2e mi-temps";
}

export function readMatchClock(clock: MatchClock, now: number): MatchClockReading {
  const target = clock.minutesPerPeriod * 60;
  const elapsed = periodElapsed(clock, now);
  return {
    main: formatClock(Math.min(elapsed, target)),
    added: elapsed > target ? `+${formatClock(elapsed - target)}` : null,
    target: formatClock(target),
    periodLabel: matchPeriodLabel(clock),
    total: formatClock(matchPlayedSeconds(clock, now)),
  };
}

// La durée de la période est-elle atteinte (pour prévenir l'éducateur) ?
export function isPeriodOver(clock: MatchClock, now: number): boolean {
  return clock.status === "running" && periodElapsed(clock, now) >= clock.minutesPerPeriod * 60;
}
