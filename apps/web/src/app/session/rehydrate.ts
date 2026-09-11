import { findTrainingActivity, type AgeGroup, type DevelopmentTheme, type TrainingSession } from "@evolyfoot/domain";

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
  // Rendez-vous (ISO), lieu et description -- voir saved-session-view.tsx (formulaire "Détails").
  // Non utilisés par la reconstruction ci-dessous, juste transportés jusqu'à l'appelant.
  meetingAt?: string | null;
  location?: string | null;
  description?: string | null;
}

// Reconstruit une `TrainingSession` du domaine à partir d'un enregistrement : chaque bloc
// retrouve son activité dans le catalogue (`findTrainingActivity`). Retourne `null` si une
// activité n'existe plus dans le catalogue -- le catalogue a alors changé depuis la sauvegarde.
export function rehydrateTrainingSession(record: SavedTrainingSession): TrainingSession | null {
  const blocks: TrainingSession["blocks"] = [];
  for (const block of record.blocks) {
    const activity = findTrainingActivity(block.activityId);
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
