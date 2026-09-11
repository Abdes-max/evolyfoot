import { validateTournament } from "@evolyfoot/domain";
import type { TournamentInput } from "@evolyfoot/domain";
import { EducatorNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, PersistedTournament, TournamentRepository } from "./repositories";

export class TournamentService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly tournamentRepository: TournamentRepository,
  ) {}

  async list(educatorId: string): Promise<PersistedTournament[]> {
    return this.tournamentRepository.listByEducator(educatorId);
  }

  async create(educatorId: string, input: TournamentInput & { date?: Date | null }): Promise<PersistedTournament> {
    const errors = validateTournament(input);
    if (Object.keys(errors).length > 0) {
      throw new ValidationError(Object.values(errors)[0]!);
    }
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    const result = input.result?.trim();
    return this.tournamentRepository.create(educatorId, {
      name: input.name.trim(),
      dateLabel: input.dateLabel.trim(),
      date: input.date ?? null,
      ...(result ? { result } : {}),
    });
  }

  async remove(educatorId: string, tournamentId: string): Promise<void> {
    return this.tournamentRepository.remove(tournamentId, educatorId);
  }
}
