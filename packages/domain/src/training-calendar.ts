import type { AgeGroup, DevelopmentTheme } from "./index";
import { personalExerciseToActivity, type PersonalExercise } from "./personal-exercise";
import { findTrainingActivity, type TrainingSession } from "./training-session";

// Le cycle du plan de progression compte 4 semaines (voir buildDevelopmentPlan).
export const trainingCycleWeekCount = 4;

const weekdayIndexes: Readonly<Record<string, number>> = { Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5 };
const defaultMeetingHour = 18;

// Rendez-vous proposé pour un créneau : le prochain jour d'entraînement, décalé selon l'écart avec
// la semaine en cours, à 18h. Simple valeur de départ, que l'éducateur peut modifier. `null` si
// le créneau n'a pas de jour réel (équipe sans jours d'entraînement renseignés).
export function suggestedMeetingAt(dayLabel: string | undefined, weekNumber: number, activeWeek: number, now: Date): string | null {
  const weekday = dayLabel ? weekdayIndexes[dayLabel] : undefined;
  if (weekday === undefined) {
    return null;
  }
  const daysAhead = (weekday - now.getDay() + 7) % 7 || 7;
  const date = new Date(now);
  date.setDate(now.getDate() + daysAhead + Math.max(weekNumber - activeWeek, 0) * 7);
  date.setHours(defaultMeetingHour, 0, 0, 0);
  return date.toISOString();
}

// « Semaine en cours » du cycle : la première semaine dont toutes les séances ne sont pas encore
// générées (une par jour d'entraînement) ; la dernière si tout est généré. Déterministe, sans état
// supplémentaire à persister.
export function currentCycleWeek(sessions: ReadonlyArray<{ weekNumber: number }>, slotsPerWeek: number): number {
  const target = Math.max(slotsPerWeek, 1);
  for (let week = 1; week <= trainingCycleWeekCount; week += 1) {
    const generated = sessions.filter((session) => session.weekNumber === week).length;
    if (generated < target) {
      return week;
    }
  }
  return trainingCycleWeekCount;
}

// Premier créneau libre du cycle, `null` si tout est généré.
export function firstFreeCycleSlot(
  sessions: ReadonlyArray<{ weekNumber: number; slot: number }>,
  slotsPerWeek: number,
): { weekNumber: number; slot: number } | null {
  for (let weekNumber = 1; weekNumber <= trainingCycleWeekCount; weekNumber += 1) {
    for (let slot = 0; slot < Math.max(slotsPerWeek, 1); slot += 1) {
      if (!sessions.some((session) => session.weekNumber === weekNumber && session.slot === slot)) {
        return { weekNumber, slot };
      }
    }
  }
  return null;
}

// Forme d'une séance renvoyée par `/api/sessions` : `blocks` ne conserve que l'identifiant de
// chaque activité (voir PersistedTrainingSessionBlock côté base), jamais l'activité complète.
export interface SavedTrainingSession {
  id: string;
  title: string;
  ageGroup: AgeGroup;
  playerCount: number;
  theme: DevelopmentTheme;
  intention: string;
  blocks: ReadonlyArray<{ id: string; activityId: string; durationMinutes: number }>;
  weekNumber: number;
  slot: number;
  // 0 pour une séance préparée depuis la saison guidée (voir guidedSeasonCycle).
  cycleNumber?: number;
  // Rendez-vous (ISO), lieu et description, transportés jusqu'à l'appelant sans servir à la
  // reconstruction ci-dessous.
  meetingAt?: string | null;
  location?: string | null;
  description?: string | null;
}

// Reconstruit une `TrainingSession` à partir d'un enregistrement : chaque bloc retrouve son activité
// dans le catalogue ou parmi les exercices personnels de l'éducateur. Retourne `null` si une
// activité n'existe plus.
export function rehydrateTrainingSession(record: SavedTrainingSession, personalExercises: readonly PersonalExercise[] = []): TrainingSession | null {
  const personalActivities = personalExercises.map(personalExerciseToActivity);
  const blocks: TrainingSession["blocks"] = [];
  for (const block of record.blocks) {
    const activity = findTrainingActivity(block.activityId) ?? personalActivities.find((candidate) => candidate.id === block.activityId);
    if (!activity) {
      return null;
    }
    blocks.push({ id: block.id, activity, durationMinutes: block.durationMinutes });
  }
  return {
    id: record.id,
    title: record.title,
    ageGroup: record.ageGroup,
    playerCount: record.playerCount,
    theme: record.theme,
    intention: record.intention,
    blocks,
  };
}
