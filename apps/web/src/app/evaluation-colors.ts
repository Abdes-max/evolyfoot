// Une couleur par évaluation comparée sur un radar (coach sur /equipe/:id, joueur/tuteur sur
// /joueur, en lecture seule) -- stable dans le temps (basée sur la position dans l'historique
// complet, pas sur l'ordre de sélection) pour qu'une évaluation garde toujours la même couleur
// d'une session à l'autre.
const compareColors = ["#3ec6f5", "#f5a93e", "#7fe0a0", "#e05fd6", "#f5e33e", "#8f7cf0"];

export function colorForEvaluation(evaluationId: string, evaluations: ReadonlyArray<{ id: string }>): string {
  const index = evaluations.findIndex((evaluation) => evaluation.id === evaluationId);
  return compareColors[Math.max(index, 0) % compareColors.length]!;
}

interface SourcedEvaluation {
  id: string;
  source?: "coach" | "player";
}

function isSelfEvaluation(evaluation: SourcedEvaluation): boolean {
  return evaluation.source === "player";
}

// Le radar s'ouvre sur la dernière note de l'éducateur et la dernière auto-évaluation : c'est leur
// écart qui intéresse, pas simplement l'entrée la plus récente de l'historique (liste la plus
// récente d'abord).
export function defaultComparedEvaluationIds(evaluations: readonly SourcedEvaluation[]): ReadonlySet<string> {
  const latestCoach = evaluations.find((evaluation) => !isSelfEvaluation(evaluation));
  const latestSelf = evaluations.find(isSelfEvaluation);
  return new Set([latestCoach, latestSelf].flatMap((evaluation) => (evaluation ? [evaluation.id] : [])));
}

export function evaluationLabel(evaluation: SourcedEvaluation, dateLabel: string): string {
  return isSelfEvaluation(evaluation) ? `Auto-évaluation · ${dateLabel}` : `Éducateur · ${dateLabel}`;
}
