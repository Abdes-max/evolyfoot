import { ageGroups, canValidateSession, findTrainingActivity } from "@evolyfoot/domain";
import type { AgeGroup, DevelopmentTheme, TrainingBlock, TrainingSession } from "@evolyfoot/domain";
import { EducatorNotFoundError, ValidationError } from "./errors";
import type {
  EducatorRepository,
  PersistedTrainingSession,
  TrainingSessionRepository,
} from "./repositories";

export interface TrainingSessionInput {
  title: string;
  ageGroup: AgeGroup;
  playerCount: number;
  theme: DevelopmentTheme;
  intention: string;
  blocks: ReadonlyArray<{ id: string; activityId: string; durationMinutes: number }>;
}

// Pas de constante partagée côté domaine pour les thèmes (contrairement à `ageGroups`) : on la
// duplique ici, alignée sur `DevelopmentTheme` et sur les mappers Prisma, pour rejeter une valeur
// invalide en 400 avant qu'elle n'atteigne la conversion vers l'enum Postgres.
const developmentThemes: ReadonlyArray<DevelopmentTheme> = [
  "Conserver le ballon",
  "Progresser ensemble",
  "Finir les actions",
  "Récupérer rapidement",
];

export class TrainingSessionService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly trainingSessionRepository: TrainingSessionRepository,
  ) {}

  async save(educatorId: string, input: TrainingSessionInput): Promise<PersistedTrainingSession> {
    if (!ageGroups.includes(input.ageGroup)) {
      throw new ValidationError("Choisis une catégorie U10 à U13.");
    }
    if (!developmentThemes.includes(input.theme)) {
      throw new ValidationError("Le thème de la séance est invalide.");
    }

    // Reconstruit la séance complète (activités résolues depuis le catalogue du domaine, pas
    // fournies par le client) pour réutiliser canValidateSession telle quelle plutôt que de
    // dupliquer la règle des 60-90 minutes ici.
    const blocks: TrainingBlock[] = input.blocks.map((block) => {
      const activity = findTrainingActivity(block.activityId);
      if (!activity) {
        throw new ValidationError(`Activité inconnue : ${block.activityId}.`);
      }
      return { id: block.id, activity, durationMinutes: block.durationMinutes };
    });

    const session: TrainingSession = {
      id: "pending",
      title: input.title,
      ageGroup: input.ageGroup,
      playerCount: input.playerCount,
      theme: input.theme,
      intention: input.intention,
      blocks,
    };

    if (!canValidateSession(session)) {
      throw new ValidationError("La séance doit durer entre 60 et 90 minutes.");
    }

    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }

    return this.trainingSessionRepository.create(educatorId, {
      title: input.title,
      ageGroup: input.ageGroup,
      playerCount: input.playerCount,
      theme: input.theme,
      intention: input.intention,
      blocks: input.blocks.map((block) => ({
        id: block.id,
        activityId: block.activityId,
        durationMinutes: block.durationMinutes,
      })),
    });
  }
}
