export { createDatabaseClient } from "./client";
export { normalizeEducatorEmail } from "./email";
export {
  DuplicateEducatorEmailError,
  EducatorNotFoundError,
  TeamNotFoundError,
} from "./errors";
export { PrismaEducatorRepository, PrismaTeamRepository } from "./prisma-repositories";
export { TeamProfileService } from "./team-profile-service";
export type {
  EducatorRecord,
  EducatorRepository,
  PersistedTeamProfile,
  TeamRepository,
} from "./repositories";
