// Évaluation d'un joueur sur les aspects les plus importants pour un jeune joueur de foot
// (U10-U13), affichée en toile d'araignée sur la page statistiques. Distincte des 4 critères du
// diagnostic (`diagnosticCriteria`) : ceux-ci portent sur des comportements collectifs observés en
// situation de jeu, ceux-ci sur des qualités individuelles notées au ressenti par l'éducateur.
export const playerEvaluationAspects = [
  "technique",
  "passe",
  "vitesse",
  "physique",
  "tactique",
  "mental",
  "tir",
] as const;

export type PlayerEvaluationAspect = (typeof playerEvaluationAspects)[number];

export const playerEvaluationAspectLabels: Readonly<Record<PlayerEvaluationAspect, string>> = {
  technique: "Technique",
  passe: "Passe",
  vitesse: "Vitesse",
  physique: "Physique",
  tactique: "Tactique",
  mental: "Mental",
  tir: "Tir",
};

export type PlayerEvaluationScores = Readonly<Record<PlayerEvaluationAspect, number>>;

export const playerEvaluationMinScore = 1;
export const playerEvaluationMaxScore = 5;

export function isPlayerEvaluationAspect(value: string): value is PlayerEvaluationAspect {
  return (playerEvaluationAspects as readonly string[]).includes(value);
}

// `null` si valide, sinon un message d'erreur -- même convention que `validateTeamProfile`
// (renvoie un objet d'erreurs) n'est pas suivie ici car il n'y a qu'une seule règle possible,
// appliquée à tous les aspects à la fois plutôt qu'un message par champ.
export function validatePlayerEvaluationScores(scores: PlayerEvaluationScores): string | null {
  for (const aspect of playerEvaluationAspects) {
    const score = scores[aspect];
    if (!Number.isInteger(score) || score < playerEvaluationMinScore || score > playerEvaluationMaxScore) {
      return `Chaque aspect doit être noté de ${playerEvaluationMinScore} à ${playerEvaluationMaxScore}.`;
    }
  }
  return null;
}

export function createEmptyPlayerEvaluationScores(): PlayerEvaluationScores {
  const midpoint = Math.round((playerEvaluationMinScore + playerEvaluationMaxScore) / 2);
  return Object.freeze(
    Object.fromEntries(playerEvaluationAspects.map((aspect) => [aspect, midpoint])) as Record<PlayerEvaluationAspect, number>,
  );
}
