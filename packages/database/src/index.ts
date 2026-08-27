export { createDatabaseClient } from "./client";
export { normalizeEducatorEmail } from "./email";
export {
  DuplicateEducatorEmailError,
  EducatorNotFoundError,
  InvalidCredentialsError,
  TeamNotFoundError,
  ValidationError,
} from "./errors";
export {
  PrismaEducatorRepository,
  PrismaSessionRepository,
  PrismaTeamRepository,
} from "./prisma-repositories";
export { AuthService } from "./auth-service";
export { TeamProfileService } from "./team-profile-service";
export type { AuthenticatedSession } from "./auth-service";
export type {
  EducatorAuthRecord,
  EducatorRecord,
  EducatorRepository,
  PersistedTeamProfile,
  SessionRecord,
  SessionRepository,
  TeamRepository,
} from "./repositories";
