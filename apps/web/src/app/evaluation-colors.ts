// Une couleur par évaluation comparée sur un radar (coach sur /equipe/:id, joueur/tuteur sur
// /joueur, en lecture seule) -- stable dans le temps (basée sur la position dans l'historique
// complet, pas sur l'ordre de sélection) pour qu'une évaluation garde toujours la même couleur
// d'une session à l'autre.
const compareColors = ["#3ec6f5", "#f5a93e", "#7fe0a0", "#e05fd6", "#f5e33e", "#8f7cf0"];

export function colorForEvaluation(evaluationId: string, evaluations: ReadonlyArray<{ id: string }>): string {
  const index = evaluations.findIndex((evaluation) => evaluation.id === evaluationId);
  return compareColors[Math.max(index, 0) % compareColors.length]!;
}
