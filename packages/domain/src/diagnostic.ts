import type { DevelopmentTheme } from "./index";
export type DiagnosticCriterion = "availability" | "scanning" | "progression" | "reactionAfterLoss";
export const diagnosticCriteria: ReadonlyArray<{ id: DiagnosticCriterion; label: string; description: string; theme: DevelopmentTheme }> = [
  { id: "availability", label: "Se rendre disponible", description: "Créer une solution utile autour du porteur.", theme: "Conserver le ballon" },
  { id: "scanning", label: "Voir avant de recevoir", description: "Prendre des informations avant le contrôle.", theme: "Progresser ensemble" },
  { id: "progression", label: "Avancer ensemble", description: "Accompagner le ballon et occuper la largeur.", theme: "Progresser ensemble" },
  { id: "reactionAfterLoss", label: "Réagir après la perte", description: "Se rapprocher et agir dès que le ballon est perdu.", theme: "Récupérer rapidement" },
];
export type DiagnosticScores = Record<DiagnosticCriterion, number>;
export interface DiagnosticSummary { average: number; priorities: Array<{ criterion: DiagnosticCriterion; label: string; score: number; theme: DevelopmentTheme }>; }
export function summarizeDiagnostic(scores: DiagnosticScores): DiagnosticSummary {
  const entries = diagnosticCriteria.map((criterion) => ({ criterion: criterion.id, label: criterion.label, score: scores[criterion.id], theme: criterion.theme }));
  if (entries.some(({ score }) => !Number.isInteger(score) || score < 1 || score > 4)) throw new Error("Chaque critère doit être évalué de 1 à 4.");
  return { average: entries.reduce((sum, item) => sum + item.score, 0) / entries.length, priorities: [...entries].sort((a, b) => a.score - b.score).slice(0, 2) };
}
