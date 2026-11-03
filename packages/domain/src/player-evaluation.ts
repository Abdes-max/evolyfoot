import { seasonLabel, seasonStartYear } from "./season";

// Évaluation d'un joueur sur les aspects les plus importants pour un jeune joueur de foot
// (U10-U13), affichée en toile d'araignée sur la page statistiques. Distincte des 4 critères du
// diagnostic (`diagnosticCriteria`) : ceux-ci portent sur des comportements collectifs observés en
// situation de jeu, ceux-ci sur des qualités individuelles notées au ressenti par l'éducateur.
export const playerEvaluationAspects = ["technique", "passe", "vitesse", "physique", "tactique", "mental", "tir"] as const;

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

export const playerEvaluationMinScore = 0;
export const playerEvaluationMaxScore = 10;

// Une évaluation est une photo à un instant donné ; on en garde un historique borné par saison
// (août à juin) pour suivre la progression sans laisser la liste enfler. Les saisons passées
// restent consultables et ne comptent plus dans la limite.
export const playerEvaluationMaxPerSeason = 10;

// Bilan d'une saison : moyenne des évaluations de l'éducateur, aspect par aspect, et écart avec la
// saison précédente pour lire la progression d'une année sur l'autre.
export interface PlayerEvaluationSeason {
  startYear: number;
  label: string;
  count: number;
  averages: Readonly<Record<PlayerEvaluationAspect, number>>;
  overall: number;
  // `null` pour la plus ancienne saison connue.
  deltaFromPrevious: number | null;
}

const roundTenth = (value: number): number => Math.round(value * 10) / 10;

export function buildPlayerEvaluationSeasons(
  evaluations: ReadonlyArray<{ scores: PlayerEvaluationScores; createdAt: string | Date; source?: string }>,
): PlayerEvaluationSeason[] {
  const bySeason = new Map<number, PlayerEvaluationScores[]>();
  for (const evaluation of evaluations) {
    const date = new Date(evaluation.createdAt);
    if (evaluation.source === "player" || Number.isNaN(date.getTime())) {
      continue;
    }
    const startYear = seasonStartYear(date);
    bySeason.set(startYear, [...(bySeason.get(startYear) ?? []), evaluation.scores]);
  }
  const ascending = [...bySeason.entries()].sort(([a], [b]) => a - b);
  const seasons: PlayerEvaluationSeason[] = [];
  for (const [startYear, list] of ascending) {
    const averages = Object.fromEntries(
      playerEvaluationAspects.map((aspect) => [aspect, roundTenth(list.reduce((sum, scores) => sum + scores[aspect], 0) / list.length)]),
    ) as Record<PlayerEvaluationAspect, number>;
    const overall = roundTenth(playerEvaluationAspects.reduce((sum, aspect) => sum + averages[aspect], 0) / playerEvaluationAspects.length);
    const previous = seasons[seasons.length - 1];
    seasons.push({
      startYear,
      label: seasonLabel(startYear),
      count: list.length,
      averages,
      overall,
      deltaFromPrevious: previous ? roundTenth(overall - previous.overall) : null,
    });
  }
  return seasons.reverse();
}

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
  return Object.freeze(Object.fromEntries(playerEvaluationAspects.map((aspect) => [aspect, midpoint])) as Record<PlayerEvaluationAspect, number>);
}
