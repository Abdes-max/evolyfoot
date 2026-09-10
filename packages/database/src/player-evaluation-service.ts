import { playerEvaluationMaxPerSeason, validatePlayerEvaluationScores } from "@evolyfoot/domain";
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

  async listByPlayer(educatorId: string, playerId: string): Promise<PersistedPlayerEvaluation[]> {
    if (!(await this.playerRepository.findById(playerId, educatorId))) {
      throw new PlayerNotFoundError();
    }
    return this.playerEvaluationRepository.listByPlayer(playerId, educatorId);
  }

  // Ajoute une évaluation datée. Historique borné (voir playerEvaluationMaxPerSeason) : au-delà,
  // il faut d'abord en retirer une -- plutôt qu'écraser silencieusement la plus ancienne.
  async add(educatorId: string, playerId: string, scores: PlayerEvaluationScores): Promise<PersistedPlayerEvaluation> {
    const error = validatePlayerEvaluationScores(scores);
    if (error) {
      throw new ValidationError(error);
    }
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    // Jamais faire confiance à un `playerId` client sans vérifier l'appartenance réelle.
    if (!(await this.playerRepository.findById(playerId, educatorId))) {
      throw new PlayerNotFoundError();
    }
    const existing = await this.playerEvaluationRepository.countByPlayer(playerId, educatorId);
    if (existing >= playerEvaluationMaxPerSeason) {
      throw new ValidationError(
        `Ce joueur a déjà ${playerEvaluationMaxPerSeason} évaluations. Retires-en une pour en ajouter une nouvelle.`,
      );
    }
    return this.playerEvaluationRepository.create(educatorId, playerId, scores);
  }

  async remove(educatorId: string, evaluationId: string): Promise<void> {
    await this.playerEvaluationRepository.remove(evaluationId, educatorId);
  }
}
