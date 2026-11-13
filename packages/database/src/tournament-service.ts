import { restrictLineupToPlayers, validateTournament } from "@evolyfoot/domain";
import type { TournamentInput } from "@evolyfoot/domain";
import { correctAttendance } from "./attendance-correction";
import { EducatorNotFoundError, TournamentNotFoundError, ValidationError } from "./errors";
import { readPlayerSelection } from "./player-selection";
import type { EducatorRepository, PersistedTournament, PlayerRepository, TournamentRepository } from "./repositories";

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
    // Effectif, pour vérifier les joueurs concernés (voir readPlayerSelection).
    private readonly playerRepository?: Pick<PlayerRepository, "listByEducator">,
  ) {}

  async list(educatorId: string): Promise<PersistedTournament[]> {
    return this.tournamentRepository.listByEducator(educatorId);
  }

  async getById(educatorId: string, id: string): Promise<PersistedTournament | null> {
    return this.tournamentRepository.findById(id, educatorId);
  }

  async create(
    educatorId: string,
    input: TournamentInput & { date?: Date | null; location?: string; selectedPlayerIds?: unknown },
  ): Promise<PersistedTournament> {
    const errors = validateTournament(input);
    if (Object.keys(errors).length > 0) {
      throw new ValidationError(Object.values(errors)[0]!);
    }
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    const result = input.result?.trim();
    const location = input.location?.trim();
    const selectedPlayerIds = await readPlayerSelection(this.playerRepository, educatorId, input.selectedPlayerIds);
    return this.tournamentRepository.create(educatorId, {
      name: input.name.trim(),
      dateLabel: input.dateLabel.trim(),
      date: input.date ?? null,
      ...(location ? { location } : {}),
      ...(result ? { result } : {}),
      ...(selectedPlayerIds !== undefined ? { selectedPlayerIds } : {}),
    });
  }

  // Date, lieu, description et bilan -- modifiables indépendamment depuis la fiche détail, même
  // principe que MatchService.updateDetails.
  async updateDetails(
    educatorId: string,
    tournamentId: string,
    input: {
      date?: Date | null;
      location?: string | null;
      description?: string | null;
      result?: string | null;
      selectedPlayerIds?: unknown;
      finished?: boolean;
    },
  ): Promise<PersistedTournament> {
    const existing = await this.tournamentRepository.findById(tournamentId, educatorId);
    if (!existing) {
      throw new TournamentNotFoundError();
    }
    if (existing.cancelledAt) {
      throw new ValidationError("Ce tournoi est annulé : rétablis-le d’abord.");
    }
    const selectedPlayerIds = await readPlayerSelection(this.playerRepository, educatorId, input.selectedPlayerIds);
    return this.tournamentRepository.update(tournamentId, educatorId, {
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.location !== undefined ? { location: normalizeOptionalText(input.location) } : {}),
      ...(input.description !== undefined ? { description: normalizeOptionalText(input.description) } : {}),
      ...(input.result !== undefined ? { result: normalizeOptionalText(input.result) } : {}),
      ...(selectedPlayerIds !== undefined ? { selectedPlayerIds } : {}),
      // Les joueurs qui ne sont plus concernés quittent la composition.
      ...(selectedPlayerIds && existing.lineup ? { lineup: restrictLineupToPlayers(existing.lineup, new Set(selectedPlayerIds)) } : {}),
      ...(input.finished !== undefined ? { finishedAt: input.finished ? (existing.finishedAt ?? new Date()) : null } : {}),
    });
  }

  // Présences validées ou corrigées par l’éducateur une fois le tournoi terminé (fini ou date passée).
  async setAttendance(educatorId: string, tournamentId: string, updates: unknown, now: Date = new Date()): Promise<PersistedTournament> {
    const existing = await this.tournamentRepository.findById(tournamentId, educatorId);
    if (!existing) {
      throw new TournamentNotFoundError();
    }
    if (existing.cancelledAt) {
      throw new ValidationError("Ce tournoi est annulé : rétablis-le d’abord.");
    }
    if (!existing.finishedAt && !(existing.date && existing.date <= now)) {
      throw new ValidationError("Les présences se valident une fois le tournoi terminé.");
    }
    const attendance = await correctAttendance({
      playerRepository: this.playerRepository,
      educatorId,
      selectedPlayerIds: existing.selectedPlayerIds,
      existing: existing.attendance,
      updates,
    });
    return this.tournamentRepository.update(tournamentId, educatorId, { attendance });
  }

  async remove(educatorId: string, tournamentId: string): Promise<void> {
    return this.tournamentRepository.remove(tournamentId, educatorId);
  }
}
