import { EducatorNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, PersistedPlayer, PlayerRepository } from "./repositories";

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ValidationError("Indique un prénom.");
  }
  return trimmed;
}

export class RosterService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly playerRepository: PlayerRepository,
  ) {}

  async list(educatorId: string): Promise<PersistedPlayer[]> {
    return this.playerRepository.listByEducator(educatorId);
  }

  async add(educatorId: string, name: string): Promise<PersistedPlayer> {
    const trimmed = normalizeName(name);
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    return this.playerRepository.create(educatorId, trimmed);
  }

  async rename(educatorId: string, playerId: string, name: string): Promise<PersistedPlayer> {
    const trimmed = normalizeName(name);
    return this.playerRepository.rename(playerId, educatorId, trimmed);
  }

  async remove(educatorId: string, playerId: string): Promise<void> {
    return this.playerRepository.remove(playerId, educatorId);
  }
}
