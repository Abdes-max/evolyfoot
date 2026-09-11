import { validatePlateau } from "@evolyfoot/domain";
import type { PlateauInput } from "@evolyfoot/domain";
import { EducatorNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, PersistedPlateau, PlateauRepository } from "./repositories";

export class PlateauService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly plateauRepository: PlateauRepository,
  ) {}

  async list(educatorId: string): Promise<PersistedPlateau[]> {
    return this.plateauRepository.listByEducator(educatorId);
  }

  async create(educatorId: string, input: PlateauInput & { date?: Date | null }): Promise<PersistedPlateau> {
    const errors = validatePlateau(input);
    if (Object.keys(errors).length > 0) {
      throw new ValidationError(Object.values(errors)[0]!);
    }
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    const result = input.result?.trim();
    return this.plateauRepository.create(educatorId, {
      name: input.name.trim(),
      dateLabel: input.dateLabel.trim(),
      date: input.date ?? null,
      ...(result ? { result } : {}),
    });
  }

  async remove(educatorId: string, plateauId: string): Promise<void> {
    return this.plateauRepository.remove(plateauId, educatorId);
  }
}
