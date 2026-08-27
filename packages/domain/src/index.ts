export type AgeGroup = "U10" | "U11" | "U12" | "U13";

export type DevelopmentTheme =
  | "Conserver le ballon"
  | "Progresser ensemble"
  | "Finir les actions"
  | "Récupérer rapidement";

export interface WeeklyFocus {
  id: string;
  label: string;
  theme: DevelopmentTheme;
  progress: number;
  sessionsCompleted: number;
  sessionsTotal: number;
}

export interface SessionPreview {
  id: string;
  title: string;
  dateLabel: string;
  durationMinutes: number;
  playerCount: number;
  intensity: "Modérée" | "Soutenue";
}

export const demoTeam = {
  name: "FC Horizon",
  ageGroup: "U12" as AgeGroup,
  playerCount: 14,
};

export const demoFocus: WeeklyFocus = {
  id: "focus-1",
  label: "Créer des solutions autour du porteur",
  theme: "Progresser ensemble",
  progress: 62,
  sessionsCompleted: 3,
  sessionsTotal: 5,
};

export const nextSession: SessionPreview = {
  id: "session-1",
  title: "Jouer, bouger, proposer",
  dateLabel: "Mardi · 18:00",
  durationMinutes: 75,
  playerCount: 14,
  intensity: "Soutenue",
};

export { suggestAdjustment } from "./progression";
export type { ObservationSummary } from "./progression";
export { suggestAdjustmentFromObservation } from "./adjustment";
export type { AdjustmentAction, AdjustmentSuggestion } from "./adjustment";
export { ageGroups, createTeamProfile, validateTeamProfile } from "./team";
export type { TeamProfile, TeamProfileErrors, TrainingDay } from "./team";
export { diagnosticCriteria, summarizeDiagnostic } from "./diagnostic";
export type { DiagnosticCriterion, DiagnosticScores, DiagnosticSummary } from "./diagnostic";
export { buildDevelopmentPlan } from "./development-plan";
export type { DevelopmentPlan, DevelopmentWeek } from "./development-plan";
export {
  adjustBlockDuration,
  canReplaceSessionActivity,
  canValidateSession,
  findTrainingActivity,
  generateTrainingSession,
  getSessionDuration,
  moveSessionBlock,
  replaceSessionActivity,
  trainingActivityCatalogue,
} from "./training-session";
export type {
  DiagramArrow,
  DiagramToken,
  DiagramTokenRole,
  DiagramZone,
  TacticalDiagram,
  TrainingActivity,
  TrainingBlock,
  TrainingBlockKind,
  TrainingSession,
} from "./training-session";
export {
  canCompleteObservation,
  completeObservation,
  createObservationDraft,
  rateObservation,
  setObservationNote,
  togglePlayerSignal,
} from "./observation";
export type {
  ObservationDraft,
  ObservationEventType,
  ObservationLevel,
  ObservationRating,
  ObservationReport,
  ObservationReportRating,
  ObservationReportSummary,
  ObservationSummaryRating,
  PlayerReference,
  PlayerSignal,
  PlayerSignalKind,
} from "./observation";
