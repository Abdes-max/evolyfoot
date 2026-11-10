import { seasonSlotDate } from "./season-program";
import type { TrainingDay } from "./team";

export type SessionScope = "upcoming" | "past";

export const sessionScopeLabels: Record<SessionScope, string> = { upcoming: "À venir", past: "Passées" };

// Même marge que pour les matchs : un entraînement commencé il y a moins de 3 h reste « à venir » (il a lieu ou vient de finir).
const gracePeriodMs = 3 * 3600_000;

// Passée : l'entraînement a commencé il y a plus de 3 h. Sans date, une séance n'est jamais passée.
export function isPastSession(date: Date | string | null | undefined, now: number): boolean {
  if (!date) return false;
  return new Date(date).getTime() < now - gracePeriodMs;
}

// Séances datées du filtre, les plus proches d'abord à venir, les plus récentes d'abord passées. Une séance sans date n'y figure pas.
export function sessionsInScope<T extends { meetingAt?: string | null }>(sessions: readonly T[], scope: SessionScope, now: number): T[] {
  return sessions
    .filter((session) => session.meetingAt && isPastSession(session.meetingAt, now) === (scope === "past"))
    .sort((a, b) => {
      const delta = new Date(a.meetingAt!).getTime() - new Date(b.meetingAt!).getTime();
      return scope === "upcoming" ? delta : -delta;
    });
}

// Un créneau de la saison est passé selon, dans l'ordre : le rendez-vous de la séance préparée, la date que lui donne la saison
// (jour d'entraînement de sa semaine), ou à défaut sa semaine par rapport à la semaine en cours.
export function isPastSeasonSlot(input: {
  meetingAt?: string | null;
  startDate: string | null;
  week: number;
  slot: number;
  trainingDays: readonly TrainingDay[];
  currentWeek: number;
  now: number;
}): boolean {
  if (input.meetingAt) return isPastSession(input.meetingAt, input.now);
  if (input.startDate && input.trainingDays.length > 0) {
    return isPastSession(seasonSlotDate(new Date(`${input.startDate}T00:00:00`), input.week, input.slot, input.trainingDays), input.now);
  }
  return input.week < input.currentWeek;
}
