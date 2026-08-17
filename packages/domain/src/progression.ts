import type { WeeklyFocus } from "./index";

export interface ObservationSummary {
  availability: number;
  scanning: number;
  reactionAfterLoss: number;
}

export interface AdjustmentSuggestion {
  action: "keep-theme" | "increase-pressure" | "consolidate";
  reason: string;
}

export function suggestAdjustment(
  focus: WeeklyFocus,
  observations: ObservationSummary,
): AdjustmentSuggestion {
  if (observations.reactionAfterLoss < 50) {
    return {
      action: "increase-pressure",
      reason: `La réaction à la perte reste fragile (${observations.reactionAfterLoss}/100) : conserver le thème avec une contrainte d'espace plus forte.`,
    };
  }

  if (focus.progress >= 75 && observations.availability >= 70) {
    return {
      action: "consolidate",
      reason: "Les comportements attendus apparaissent régulièrement : prévoir une séance de consolidation avant le thème suivant.",
    };
  }

  return {
    action: "keep-theme",
    reason: "La progression est visible mais encore irrégulière : conserver le thème une semaine supplémentaire.",
  };
}
