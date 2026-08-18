import type { DevelopmentWeek } from "./development-plan";
import { diagnosticCriteria, type DiagnosticCriterion } from "./diagnostic";
import type { DevelopmentTheme } from "./index";
import type { ObservationReport } from "./observation";

export type AdjustmentAction = "reinforce" | "progress" | "maintain";

export interface AdjustmentSuggestion {
  readonly id: string;
  readonly action: AdjustmentAction;
  readonly title: string;
  readonly reason: string;
  readonly triggerScore: number;
  readonly proposedTheme: DevelopmentTheme;
  readonly constraint: string;
  readonly observable: string;
  readonly impact: string;
}

const allowedScores = new Set([0, 50, 100]);

function invalidReport(message: string): never {
  throw new Error(`Rapport d'observation invalide : ${message}`);
}

function validateRatings(report: ObservationReport): void {
  if (!report || !Array.isArray(report.ratings) || report.ratings.length !== diagnosticCriteria.length) {
    invalidReport("les quatre critères diagnostiques doivent être présents une seule fois chacun.");
  }

  const criteria = report.ratings.map((rating) => rating?.criterion);
  const canonicalCriteria = diagnosticCriteria.map((criterion) => criterion.id);
  if (
    new Set(criteria).size !== canonicalCriteria.length ||
    criteria.some((criterion) => !canonicalCriteria.includes(criterion as DiagnosticCriterion))
  ) {
    invalidReport("les quatre critères diagnostiques doivent être présents une seule fois chacun.");
  }

  if (report.ratings.some((rating) => !allowedScores.has(rating.score))) {
    invalidReport("chaque score doit être 0, 50 et 100.");
  }
}

function suggestionFor(
  report: ObservationReport,
  currentWeek: DevelopmentWeek,
  weakest: { criterion: (typeof diagnosticCriteria)[number]; score: number },
  averageScore: number,
): AdjustmentSuggestion {
  const { criterion, score } = weakest;
  const reason = `${criterion.label} est à ${score}/100.`;

  if (score === 0) {
    return {
      id: `adjustment-${report.id}`,
      action: "reinforce",
      title: `Renforcer · ${criterion.label}`,
      reason: `${reason} Le comportement sera répété dans une situation plus lisible avant d'ajouter de la pression.`,
      triggerScore: score,
      proposedTheme: criterion.theme,
      constraint: "Espace légèrement agrandi, opposition progressive, répétitions courtes.",
      observable: `Le comportement « ${criterion.label} » apparaît dans des situations lisibles.`,
      impact: "Davantage de répétitions courtes avant d'augmenter la pression.",
    };
  }

  if (averageScore >= 75) {
    return {
      id: `adjustment-${report.id}`,
      action: "progress",
      title: `Faire progresser · ${currentWeek.theme}`,
      reason: `La moyenne atteint ${averageScore}/100 et aucun comportement n'est à 0. ${criterion.label} reste le repère le plus faible à observer.`,
      triggerScore: averageScore,
      proposedTheme: currentWeek.theme,
      constraint: "Espace réduit ou décision à prendre plus vite.",
      observable: `Le comportement « ${criterion.label} » reste présent quand le temps ou l'espace diminue.`,
      impact: "Une seule contrainte augmente pour tester le comportement dans un contexte plus exigeant.",
    };
  }

  return {
    id: `adjustment-${report.id}`,
    action: "maintain",
    title: `Garder le cap · ${currentWeek.theme}`,
    reason: `${reason} Le thème et la contrainte actuels sont conservés pour stabiliser ce repère.`,
    triggerScore: score,
    proposedTheme: currentWeek.theme,
    constraint: "Même organisation.",
    observable: `Continuer à observer « ${criterion.label} » dans l'organisation actuelle.`,
    impact: "Le thème reste inchangé afin de consolider le repère le plus faible.",
  };
}

export function suggestAdjustmentFromObservation(
  report: ObservationReport,
  currentWeek: DevelopmentWeek,
): AdjustmentSuggestion {
  validateRatings(report);

  const orderedRatings = diagnosticCriteria.map((criterion) => ({
    criterion,
    score: report.ratings.find((rating) => rating.criterion === criterion.id)?.score as number,
  }));
  const weakest = orderedRatings.reduce((best, candidate) =>
    candidate.score < best.score ? candidate : best,
  );
  const averageScore = orderedRatings.reduce((sum, rating) => sum + rating.score, 0) / orderedRatings.length;

  return Object.freeze(suggestionFor(report, currentWeek, weakest, averageScore));
}
