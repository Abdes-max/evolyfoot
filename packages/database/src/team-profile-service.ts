import { createTeamProfile } from "@evolyfoot/domain";
import type { TeamProfile } from "@evolyfoot/domain";
import { EducatorNotFoundError, TeamNotFoundError } from "./errors";
import type {
  EducatorRepository,
  PersistedTeamProfile,
  TeamRepository,
} from "./repositories";

export class TeamProfileService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly teamRepository: TeamRepository,
  ) {}

  async save(educatorId: string, profile: TeamProfile): Promise<PersistedTeamProfile> {
    const validatedProfile = createTeamProfile(profile);
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    return this.teamRepository.upsertForEducator(educatorId, validatedProfile);
  }

  async get(educatorId: string): Promise<PersistedTeamProfile> {
    const team = await this.teamRepository.findForEducator(educatorId);
    if (team === null) {
      throw new TeamNotFoundError();
    }
    return team;
  }
}
