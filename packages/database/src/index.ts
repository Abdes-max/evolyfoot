export { createDatabaseClient } from "./client";
export { normalizeEducatorEmail } from "./email";
export {
  DiagnosticNotFoundError,
  DuplicateEducatorEmailError,
  EducatorNotFoundError,
  InvalidCredentialsError,
  MatchNotFoundError,
  ObservationNotFoundError,
  PlayerNotFoundError,
  TeamNotFoundError,
  ValidationError,
} from "./errors";
export {
  PrismaDiagnosticRepository,
  PrismaEducatorRepository,
  PrismaMatchRepository,
  PrismaObservationRepository,
  PrismaPlayerRepository,
  PrismaSessionRepository,
  PrismaTeamRepository,
  PrismaTrainingSessionRepository,
} from "./prisma-repositories";
export { AuthService } from "./auth-service";
export { DiagnosticService } from "./diagnostic-service";
export { MatchService } from "./match-service";
export { MetricsService } from "./metrics-service";
export { ObservationService } from "./observation-service";
export { RosterService } from "./roster-service";
export { TeamProfileService } from "./team-profile-service";
export { TrainingSessionService } from "./training-session-service";
export type { AuthenticatedSession } from "./auth-service";
export type { FunnelStep, MvpMetrics, WeeklyActivityPoint } from "./metrics-service";
export type { TrainingSessionInput } from "./training-session-service";
export type {
  DiagnosticRepository,
  EducatorAuthRecord,
  EducatorRecord,
  EducatorRepository,
  MatchRepository,
  ObservationRepository,
  PersistedDiagnostic,
  PersistedMatch,
  PersistedObservation,
  PersistedPlayer,
  PersistedTeamProfile,
  PersistedTrainingSession,
  PersistedTrainingSessionBlock,
  PlayerRepository,
  SessionRecord,
  SessionRepository,
  TeamRepository,
  TrainingSessionRepository,
} from "./repositories";
