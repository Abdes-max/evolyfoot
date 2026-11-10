import type { ProgramSituation, ProgramSubTheme, SituationKind, SituationLayout } from "./season-program";

// Situations de la programmation de saison, rédigées par EvolyFoot à partir de la structure CFI
// U10-U11 et U12-U13 (sous-thème, format, surface, séquences). Les ids sont stables : des séances enregistrées
// y font référence (`cfi-…`), ne jamais renommer ni supprimer une entrée.
export interface SituationInput {
  title: string;
  objective: string;
  organization: string;
  instruction: string;
  observable: string;
  rules: string[];
  coachingPoints: string[];
  rotation?: string;
  variation?: string;
  equipment?: string[];
}

export function situation(
  id: string,
  kind: SituationKind,
  subTheme: ProgramSubTheme | "recreational",
  field: string,
  sequences: [number, number],
  layout: SituationLayout,
  input: SituationInput,
): ProgramSituation {
  return {
    id: `cfi-${id}`,
    kind,
    subTheme,
    sequences: { count: sequences[0], minutes: sequences[1] },
    layout,
    title: input.title,
    objective: input.objective,
    organization: input.organization,
    instruction: input.instruction,
    observable: input.observable,
    rules: input.rules,
    coachingPoints: input.coachingPoints,
    rotation: input.rotation ?? "",
    variation: input.variation ?? "",
    equipment: input.equipment ?? ["Plots", "Chasubles", "Ballons"],
    fieldSize: field,
    defenderCount: layout.defenders,
    hasGoalkeeper: layout.keepers > 0,
  };
}
