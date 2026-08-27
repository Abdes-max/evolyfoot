import type { TeamProfile } from "@evolyfoot/domain";

export interface EducatorRecord {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EducatorAuthRecord extends EducatorRecord {
  passwordHash: string;
}

export interface PersistedTeamProfile {
  id: string;
  educatorId: string;
  profile: TeamProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface EducatorRepository {
  create(input: { email: string; displayName: string; passwordHash: string }): Promise<EducatorRecord>;
  existsById(id: string): Promise<boolean>;
  findById(id: string): Promise<EducatorRecord | null>;
  findByEmail(email: string): Promise<EducatorAuthRecord | null>;
}

export interface TeamRepository {
  upsertForEducator(educatorId: string, profile: TeamProfile): Promise<PersistedTeamProfile>;
  findForEducator(educatorId: string): Promise<PersistedTeamProfile | null>;
}

export interface SessionRecord {
  id: string;
  educatorId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface SessionRepository {
  create(input: { educatorId: string; tokenHash: string; expiresAt: Date }): Promise<SessionRecord>;
  findValidByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
}
