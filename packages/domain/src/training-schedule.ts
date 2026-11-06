import { sortTrainingDays, type TrainingDay } from "./team";

// Créneau récurrent d'un jour d'entraînement, défini à la création de la saison : chaque séance
// préparée ce jour-là reprend cette heure et ce lieu par défaut (ex. lundi 12:00 à Aix, mercredi
// 16:00 à Marseille).
export interface TrainingSlotSchedule {
  readonly day: TrainingDay;
  readonly time: string;
  readonly location: string;
}

const days: readonly TrainingDay[] = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
export const defaultTrainingTime = "18:00";

// Créneaux reçus d'un formulaire : un par jour au plus, heure au format HH:MM, lieu facultatif
// (128 caractères au plus). `undefined` = champ absent.
export function parseTrainingSchedule(value: unknown): TrainingSlotSchedule[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Créneaux invalides.");
  const seen = new Set<TrainingDay>();
  return value.map((entry) => {
    const day = (entry as { day?: unknown })?.day;
    const time = (entry as { time?: unknown })?.time;
    const location = (entry as { location?: unknown })?.location;
    if (typeof day !== "string" || !days.includes(day as TrainingDay) || seen.has(day as TrainingDay)) {
      throw new Error("Jour d’entraînement invalide.");
    }
    if (typeof time !== "string" || !timePattern.test(time)) {
      throw new Error(`Heure invalide pour le ${day.toLowerCase()} (format 18:00).`);
    }
    if (location !== undefined && location !== null && (typeof location !== "string" || location.length > 128)) {
      throw new Error(`Lieu invalide pour le ${day.toLowerCase()}.`);
    }
    seen.add(day as TrainingDay);
    return { day: day as TrainingDay, time, location: typeof location === "string" ? location.trim() : "" };
  });
}

// Heure et lieu du créneau `slot` (index dans les jours d'entraînement triés, comme seasonSlotDate).
export function scheduleForSlot(
  schedule: readonly TrainingSlotSchedule[] | null | undefined,
  trainingDays: readonly TrainingDay[],
  slot: number,
): { time: string; location: string } {
  const sorted = sortTrainingDays(trainingDays);
  const day = sorted[slot] ?? sorted[sorted.length - 1];
  const entry = schedule?.find((candidate) => candidate.day === day);
  return { time: entry?.time ?? defaultTrainingTime, location: entry?.location ?? "" };
}
