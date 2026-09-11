import { validateTournament } from "@evolyfoot/domain";
import type { TournamentInput } from "@evolyfoot/domain";
import { EducatorNotFoundError, TournamentNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, PersistedTournament, TournamentRepository } from "./repositories";

// Champ libre facultatif (lieu, description) : même principe que
// TrainingSessionService.normalizeOptionalText.
function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export class TournamentService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly tournamentRepository: TournamentRepository,
  ) {}

  async list(educatorId: string): Promise<PersistedTournament[]> {
    return this.tournamentRepository.listByEducator(educatorId);
  }

  async getById(educatorId: string, id: string): Promise<PersistedTournament | null> {
    return this.tournamentRepository.findById(id, educatorId);
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

  // Date, lieu, description et bilan -- modifiables indépendamment depuis la fiche détail, même
  // principe que MatchService.updateDetails.
  async updateDetails(
    educatorId: string,
    tournamentId: string,
    input: { date?: Date | null; location?: string | null; description?: string | null; result?: string | null },
  ): Promise<PersistedTournament> {
    const existing = await this.tournamentRepository.findById(tournamentId, educatorId);
    if (!existing) {
      throw new TournamentNotFoundError();
    }
    return this.tournamentRepository.update(tournamentId, educatorId, {
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.location !== undefined ? { location: normalizeOptionalText(input.location) } : {}),
      ...(input.description !== undefined ? { description: normalizeOptionalText(input.description) } : {}),
      ...(input.result !== undefined ? { result: normalizeOptionalText(input.result) } : {}),
    });
  }

  async remove(educatorId: string, tournamentId: string): Promise<void> {
    return this.tournamentRepository.remove(tournamentId, educatorId);
  }
}
