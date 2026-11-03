import type { DevelopmentTheme } from "./index";
import { buildDiagram, type TrainingActivity, type TrainingBlockKind } from "./training-session";

// Exercice créé ou importé par l'éducateur. Une séance le référence par `perso-<id>` dans
// `activityId`, à côté des identifiants du catalogue.
export const personalActivityPrefix = "perso-";
export const personalExerciseMaxPerEducator = 200;
export const personalExerciseMaxPhotoLength = 700_000;

const blockKinds: readonly TrainingBlockKind[] = ["welcome", "activation", "main", "game"];
const themes: readonly DevelopmentTheme[] = ["Conserver le ballon", "Progresser ensemble", "Finir les actions", "Récupérer rapidement"];

export interface PersonalExerciseInput {
  kind: TrainingBlockKind;
  theme: DevelopmentTheme;
  title: string;
  objective: string;
  organization: string;
  instruction: string;
  observable: string;
  // Photo d'un schéma papier, en data URL d'image.
  photo: string | null;
}

export interface PersonalExercise extends PersonalExerciseInput {
  id: string;
}

export function isPersonalActivityId(activityId: string): boolean {
  return activityId.startsWith(personalActivityPrefix);
}

// `null` si valide, sinon un message d'erreur -- même convention que validatePlayerEvaluationScores.
export function validatePersonalExercise(input: PersonalExerciseInput): string | null {
  if (!blockKinds.includes(input.kind)) return "Choisis le temps de séance de cet exercice.";
  if (!themes.includes(input.theme)) return "Choisis le thème de cet exercice.";
  if (!input.title.trim() || input.title.length > 120) return "Donne un titre de 120 caractères maximum.";
  for (const field of [input.objective, input.organization, input.instruction, input.observable]) {
    if (field.length > 1000) return "Chaque champ est limité à 1000 caractères.";
  }
  if (input.photo !== null && (!input.photo.startsWith("data:image/") || input.photo.length > personalExerciseMaxPhotoLength)) {
    return "La photo n’est pas valide ou est trop lourde.";
  }
  return null;
}

export function personalExerciseToActivity(exercise: PersonalExercise): TrainingActivity {
  return {
    id: `${personalActivityPrefix}${exercise.id}`,
    kind: exercise.kind,
    title: exercise.title,
    compatibleThemes: [exercise.theme],
    objective: exercise.objective,
    organization: exercise.organization,
    instruction: exercise.instruction,
    observable: exercise.observable,
    rules: [],
    coachingPoints: [],
    equipment: [],
    fieldSize: "",
    defenderCount: 0,
    hasGoalkeeper: false,
    diagram: buildDiagram(exercise.kind, 0, false),
    ...(exercise.photo ? { photo: exercise.photo } : {}),
  };
}

const labelledFields: ReadonlyArray<{ pattern: RegExp; field: "objective" | "organization" | "instruction" | "observable" }> = [
  { pattern: /^(objectif|but)\s*:\s*/i, field: "objective" },
  { pattern: /^(organisation|mise en place)\s*:\s*/i, field: "organization" },
  { pattern: /^(consigne|consignes)\s*:\s*/i, field: "instruction" },
  { pattern: /^(à observer|a observer|observable)\s*:\s*/i, field: "observable" },
];

export type ImportedExerciseText = Pick<PersonalExerciseInput, "title" | "objective" | "organization" | "instruction" | "observable">;

// Pré-remplit la fiche depuis un texte collé : première ligne en titre, lignes « Objectif : ... »
// reconnues, le reste rejoint l'organisation. L'éducateur relit toujours avant d'enregistrer.
export function parseExerciseText(text: string): ImportedExerciseText {
  const [title = "", ...lines] = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const result: ImportedExerciseText = { title, objective: "", organization: "", instruction: "", observable: "" };
  let current: keyof ImportedExerciseText = "organization";
  for (const line of lines) {
    const label = labelledFields.find(({ pattern }) => pattern.test(line));
    if (label) {
      current = label.field;
    }
    const content = label ? line.replace(label.pattern, "") : line;
    result[current] = result[current] ? `${result[current]} ${content}` : content;
  }
  return result;
}
