import { validatePlateau } from "@evolyfoot/domain";
import type { PlateauInput } from "@evolyfoot/domain";
import { EducatorNotFoundError, PlateauNotFoundError, ValidationError } from "./errors";
import { readPlayerSelection } from "./player-selection";
import type { EducatorRepository, PersistedPlateau, PlayerRepository, PlateauRepository } from "./repositories";

// Champ libre facultatif (lieu, description) : même principe que
// TrainingSessionService.normalizeOptionalText.
function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export class PlateauService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly plateauRepository: PlateauRepository,
    // Effectif, pour vérifier les joueurs concernés (voir readPlayerSelection).
    private readonly playerRepository?: Pick<PlayerRepository, "listByEducator">,
  ) {}

  async list(educatorId: string): Promise<PersistedPlateau[]> {
    return this.plateauRepository.listByEducator(educatorId);
  }

  async getById(educatorId: string, id: string): Promise<PersistedPlateau | null> {
    return this.plateauRepository.findById(id, educatorId);
  }

  async create(educatorId: string, input: PlateauInput & { date?: Date | null; location?: string; selectedPlayerIds?: unknown }): Promise<PersistedPlateau> {
    const errors = validatePlateau(input);
    if (Object.keys(errors).length > 0) {
      throw new ValidationError(Object.values(errors)[0]!);
    }
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    const result = input.result?.trim();
    const location = input.location?.trim();
    const selectedPlayerIds = await readPlayerSelection(this.playerRepository, educatorId, input.selectedPlayerIds);
    return this.plateauRepository.create(educatorId, {
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
    plateauId: string,
    input: { date?: Date | null; location?: string | null; description?: string | null; result?: string | null; selectedPlayerIds?: unknown },
  ): Promise<PersistedPlateau> {
    const existing = await this.plateauRepository.findById(plateauId, educatorId);
    if (!existing) {
      throw new PlateauNotFoundError();
    }
    const selectedPlayerIds = await readPlayerSelection(this.playerRepository, educatorId, input.selectedPlayerIds);
    return this.plateauRepository.update(plateauId, educatorId, {
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.location !== undefined ? { location: normalizeOptionalText(input.location) } : {}),
      ...(input.description !== undefined ? { description: normalizeOptionalText(input.description) } : {}),
      ...(input.result !== undefined ? { result: normalizeOptionalText(input.result) } : {}),
      ...(selectedPlayerIds !== undefined ? { selectedPlayerIds } : {}),
    });
  }

  async remove(educatorId: string, plateauId: string): Promise<void> {
    return this.plateauRepository.remove(plateauId, educatorId);
  }
}
