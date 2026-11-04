import { validateSeasonPriorities } from "@evolyfoot/domain";
import { EducatorNotFoundError } from "./errors";
import type { EducatorRepository, PersistedSeasonProgram, SeasonProgramRepository } from "./repositories";

export class SeasonProgramService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly seasonProgramRepository: SeasonProgramRepository,
  ) {}

  // Garde la semaine de départ d'une saison déjà lancée : changer de priorités ne remet pas la
  // saison à zéro.
  async save(educatorId: string, priorities: unknown, now = new Date()): Promise<PersistedSeasonProgram> {
    const themes = validateSeasonPriorities(priorities);
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    const existing = await this.seasonProgramRepository.findForEducator(educatorId);
    return this.seasonProgramRepository.upsertForEducator(educatorId, themes, existing?.startDate ?? now);
  }

  get(educatorId: string): Promise<PersistedSeasonProgram | null> {
    return this.seasonProgramRepository.findForEducator(educatorId);
  }
}
