import {
  parseCompetitionLineup,
  teamLineupMaxSubstitutes,
  validateCompetitionLineup,
  type CompetitionLineup,
  createTeamProfile,
  validateTeamLogo,
} from "@evolyfoot/domain";
import type { TeamProfile } from "@evolyfoot/domain";
import { EducatorNotFoundError, TeamNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, PersistedTeamProfile, TeamRepository } from "./repositories";

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

  // Choisit le logo de l'équipe (data URL) ou le retire (`null`).
  async saveLogo(educatorId: string, logo: string | null): Promise<PersistedTeamProfile> {
    if (logo !== null) {
      const problem = validateTeamLogo(logo);
      if (problem) {
        throw new ValidationError(problem);
      }
    }
    return this.teamRepository.updateLogo(educatorId, logo);
  }

  async defaultLineup(educatorId: string): Promise<CompetitionLineup | null> {
    return this.teamRepository.findDefaultLineup(educatorId);
  }

  // Compo type : 6 remplaçants au plus, joueurs de l'effectif (noms relus côté serveur).
  async saveDefaultLineup(educatorId: string, value: unknown, roster: ReadonlyMap<string, string>): Promise<CompetitionLineup | null> {
    if (value === null) {
      await this.teamRepository.updateDefaultLineup(educatorId, null);
      return null;
    }
    const parsed = parseCompetitionLineup(value);
    if (!parsed) {
      throw new ValidationError("Composition invalide.");
    }
    if ([...parsed.lineup.map((assignment) => assignment.playerId), ...parsed.substitutePlayerIds].some((playerId) => !roster.has(playerId))) {
      throw new ValidationError("Un joueur de la composition ne fait pas partie de l’effectif.");
    }
    const lineup: CompetitionLineup = {
      ...parsed,
      lineup: parsed.lineup.map((assignment) => ({ ...assignment, playerName: roster.get(assignment.playerId)! })),
    };
    const problem = validateCompetitionLineup(lineup, teamLineupMaxSubstitutes);
    if (problem) {
      throw new ValidationError(problem);
    }
    await this.teamRepository.updateDefaultLineup(educatorId, lineup);
    return lineup;
  }

  async get(educatorId: string): Promise<PersistedTeamProfile> {
    const team = await this.teamRepository.findForEducator(educatorId);
    if (team === null) {
      throw new TeamNotFoundError();
    }
    return team;
  }
}
