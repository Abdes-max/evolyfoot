import type { TeamProfile } from "@evolyfoot/domain";

export interface EducatorRecord {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersistedTeamProfile {
  id: string;
  educatorId: string;
  profile: TeamProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface EducatorRepository {
  create(input: { email: string; displayName: string }): Promise<EducatorRecord>;
  existsById(id: string): Promise<boolean>;
}

export interface TeamRepository {
  upsertForEducator(educatorId: string, profile: TeamProfile): Promise<PersistedTeamProfile>;
  findForEducator(educatorId: string): Promise<PersistedTeamProfile | null>;
}
