import { validatePlayerEvaluationScores } from "@evolyfoot/domain";
import type { PlayerEvaluationScores } from "@evolyfoot/domain";
import { EducatorNotFoundError, PlayerNotFoundError, ValidationError } from "./errors";
import type {
  EducatorRepository,
  PersistedPlayerEvaluation,
  PlayerEvaluationRepository,
  PlayerRepository,
} from "./repositories";

export class PlayerEvaluationService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly playerEvaluationRepository: PlayerEvaluationRepository,
  ) {}

  async list(educatorId: string): Promise<PersistedPlayerEvaluation[]> {
    return this.playerEvaluationRepository.listByEducator(educatorId);
  }

  async save(educatorId: string, playerId: string, scores: PlayerEvaluationScores): Promise<PersistedPlayerEvaluation> {
    const error = validatePlayerEvaluationScores(scores);
    if (error) {
      throw new ValidationError(error);
    }
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    // Vérifie l'appartenance réelle du joueur avant d'écrire -- jamais faire confiance à un
    // `playerId` fourni par le client sans vérifier qu'il appartient bien à cet éducateur (même
    // principe que RosterService.rename/remove, PlayerRepository.findById ajouté pour ça).
    if (!(await this.playerRepository.findById(playerId, educatorId))) {
      throw new PlayerNotFoundError();
    }
    return this.playerEvaluationRepository.upsert(educatorId, playerId, scores);
  }
}
