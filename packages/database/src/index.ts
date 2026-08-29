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
  PrismaSessionRepository,
  PrismaTeamRepository,
} from "./prisma-repositories";
export { AuthService } from "./auth-service";
export { DiagnosticService } from "./diagnostic-service";
export { TeamProfileService } from "./team-profile-service";
export type { AuthenticatedSession } from "./auth-service";
export type {
  DiagnosticRepository,
  EducatorAuthRecord,
  EducatorRecord,
  EducatorRepository,
  PersistedDiagnostic,
  PersistedTeamProfile,
  SessionRecord,
  SessionRepository,
  TeamRepository,
} from "./repositories";
