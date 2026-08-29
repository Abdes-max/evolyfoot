export { createDatabaseClient } from "./client";
export { normalizeEducatorEmail } from "./email";
export {
  DiagnosticNotFoundError,
  DuplicateEducatorEmailError,
  EducatorNotFoundError,
  InvalidCredentialsError,
  TeamNotFoundError,
  ValidationError,
} from "./errors";
export {
  PrismaDiagnosticRepository,
  PrismaEducatorRepository,
  PrismaObservationRepository,
  PrismaSessionRepository,
  PrismaTeamRepository,
  PrismaTrainingSessionRepository,
} from "./prisma-repositories";
export { AuthService } from "./auth-service";
export { DiagnosticService } from "./diagnostic-service";
export { ObservationService } from "./observation-service";
export { TeamProfileService } from "./team-profile-service";
export { TrainingSessionService } from "./training-session-service";
export type { AuthenticatedSession } from "./auth-service";
export type { TrainingSessionInput } from "./training-session-service";
export type {
  DiagnosticRepository,
  EducatorAuthRecord,
  EducatorRecord,
  EducatorRepository,
  ObservationRepository,
  PersistedDiagnostic,
  PersistedObservation,
  PersistedTeamProfile,
  PersistedTrainingSession,
  PersistedTrainingSessionBlock,
  SessionRecord,
  SessionRepository,
  TeamRepository,
  TrainingSessionRepository,
} from "./repositories";
