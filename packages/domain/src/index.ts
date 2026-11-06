import type { GameFormat } from "./team";

export type AgeGroup = "U10" | "U11" | "U12" | "U13";

export type { DevelopmentTheme } from "./themes";
import type { DevelopmentTheme } from "./themes";
export { developmentThemes } from "./themes";

export interface WeeklyFocus {
  id: string;
  label: string;
  theme: DevelopmentTheme;
  progress: number;
  sessionsCompleted: number;
  sessionsTotal: number;
}

export const demoTeam = {
  name: "FC Horizon",
  ageGroup: "U12" as AgeGroup,
  gameFormat: 8 as GameFormat,
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

export { suggestAdjustment } from "./progression";
export type { ObservationSummary } from "./progression";
export { suggestAdjustmentFromObservation } from "./adjustment";
export type { AdjustmentAction, AdjustmentSuggestion } from "./adjustment";
export { buildSeasonCalendar, seasonLabel, seasonStartDate, seasonStartYear } from "./season";
export type { SeasonCalendar, SeasonEvent, SeasonEventInput, SeasonEventType, SeasonMonth } from "./season";
export {
  isPersonalActivityId,
  parseExerciseText,
  personalActivityPrefix,
  personalExerciseMaxPerEducator,
  personalExerciseToActivity,
  validatePersonalExercise,
} from "./personal-exercise";
export type { ImportedExerciseText, PersonalExercise, PersonalExerciseInput } from "./personal-exercise";
export { currentCycleWeek, firstFreeCycleSlot, rehydrateTrainingSession, suggestedMeetingAt, trainingCycleWeekCount } from "./training-calendar";
export type { SavedTrainingSession } from "./training-calendar";
export { ageGroups, createTeamProfile, gameFormats, sortTrainingDays, validateTeamProfile } from "./team";
export type { GameFormat, TeamProfile, TeamProfileErrors, TrainingDay } from "./team";
export { diagnosticCriteria, summarizeDiagnostic } from "./diagnostic";
export type { DiagnosticCriterion, DiagnosticScores, DiagnosticSummary } from "./diagnostic";
export { buildDevelopmentPlan } from "./development-plan";
export type { DevelopmentPlan, DevelopmentWeek } from "./development-plan";
export {
  adjustBlockDuration,
  canReplaceSessionActivity,
  canValidateSession,
  findTrainingActivity,
  explainTrainingSession,
  generateTrainingSession,
  replaceBlockActivity,
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
export { canCompleteObservation, completeObservation, createObservationDraft, rateObservation, setObservationNote, togglePlayerSignal } from "./observation";
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
export {
  addSubstitute,
  assignPlayerToSlot,
  canFinalizeMatchPlan,
  changeFormation,
  transferLineup,
  clearSlot,
  createMatchPlan,
  defaultFormationId,
  formationSlots,
  isLineupComplete,
  listFormations,
  maxSubstitutes,
  removeSubstitute,
  setCaptain,
  validateMatchPlan,
} from "./match";
export { ballFrame, buildDiagramAnimation, diagramAnimationStepCount, diagramTargets, exerciseScenario, targetGeometry } from "./diagram-animation";
export type {
  AnimatedExercise,
  AnimationBall,
  AnimationBallKind,
  AnimationPoint,
  AnimationStep,
  BallFrame,
  DiagramTarget,
  DiagramTargetKind,
  ExerciseScenario,
  TargetGeometry,
} from "./diagram-animation";
export { fixtureFromTitle, parseCalendarFile } from "./calendar-import";
export type { CalendarEvent, ImportedFixture } from "./calendar-import";
export { analyzeMatchup } from "./tactical-analysis";
export type { LineBalance, MatchupAnalysis, MatchupLine } from "./tactical-analysis";
export { buildSeasonPlan } from "./season-plan";
export type { SeasonPlanCycle } from "./season-plan";
export { allFormationIds, playStyleNote, playStyles } from "./coach-style";
export type { PlayStyle } from "./coach-style";
export { matchResultMaxGoals, playerSeasonTotals, validateMatchResult } from "./match-result";
export type { MatchPlayerStat, MatchResult, PlayerSeasonTotals } from "./match-result";
export type { Formation, LineupRole, MatchLineupAssignment, MatchLineupSlot, MatchPlan, MatchPlanErrors, MatchStatus, MatchVenue } from "./match";
export {
  buildPlayerEvaluationSeasons,
  createEmptyPlayerEvaluationScores,
  isPlayerEvaluationAspect,
  playerEvaluationAspectLabels,
  playerEvaluationAspects,
  playerEvaluationMaxPerSeason,
  playerEvaluationMaxScore,
  playerEvaluationMinScore,
  validatePlayerEvaluationScores,
} from "./player-evaluation";
export type { PlayerEvaluationAspect, PlayerEvaluationScores, PlayerEvaluationSeason } from "./player-evaluation";
export { isValidJerseyNumber, playerAspectCodes, playerFeet, playerOverallScore, playerPositionCodes, playerPositions } from "./player-profile";
export type { PlayerFoot, PlayerPosition } from "./player-profile";
export { validateTournament } from "./tournament";
export type { TournamentErrors, TournamentInput } from "./tournament";
export { validatePlateau } from "./plateau";
export type { PlateauErrors, PlateauInput } from "./plateau";
export {
  attendanceStatuses,
  attendanceStatusCodes,
  attendanceStatusLabels,
  attendanceStatusOf,
  createAttendanceEntry,
  summarizeAttendance,
} from "./attendance";
export type { AttendanceEntry, AttendanceStatus, AttendanceSummary } from "./attendance";
export {
  attendanceDefaultOptions,
  convocationDue,
  convocationLeadOptions,
  convocationSendDate,
  isAttendanceDefault,
  isValidLeadDays,
  summarizeTrainingResponses,
} from "./training-convocation";
export type { AttendanceDefault, ResponsePlayer, TrainingConvocationSettings, TrainingResponses } from "./training-convocation";
export { concernedPlayers, isConcerned, parsePlayerSelection } from "./concerned-players";
export type { PlayerSelection } from "./concerned-players";
export { messageMaxLength, validateMessageText } from "./message";
export type { Message, MessageAuthorRole } from "./message";
export { buildTeamStatsReport, pluralize } from "./team-stats-report";
export type { AttendanceStats, TeamStats } from "./team-stats-report";
export { convocationFeedback } from "./convocation";

export type {
  FieldMarks,
  GamePhase,
  ProgramSessionPlan,
  ProgramSituation,
  ProgramSubTheme,
  ProgramSubThemeInfo,
  SeasonOptions,
  SeasonSlot,
  SeasonWeek,
  SituationKind,
  SituationLayout,
} from "./season-program";
export {
  buildPrioritizedSeason,
  buildSituationDiagram,
  findProgramSession,
  guidedSeasonCycle,
  majorShare,
  maxSeasonPriorities,
  programPrinciples,
  programSessionPlan,
  programSource,
  programSubThemeIds,
  programSubThemes,
  programValues,
  seasonWeekCount,
  situationKindLabels,
  situationMinutes,
  situationToActivity,
  subThemesOf,
  mondayOf,
  seasonSlotDate,
  seasonThemeCounts,
  seasonWeekAt,
  suggestSeasonPriorities,
  validateSeasonPriorities,
} from "./season-program";
export type { ProgramSessionDefinition } from "./program-sessions";
export { programSessions } from "./program-sessions";
export { findProgramSituation, programSituations } from "./program-situations";
export type { FieldState, FieldStep } from "./field-timer";
export {
  clock as fieldClock,
  fieldSteps,
  goTo as goToFieldStep,
  next as nextFieldStep,
  score as scoreField,
  startField,
  tick as tickField,
  toggle as toggleField,
} from "./field-timer";
