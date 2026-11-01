import { personalExerciseMaxPerEducator, validatePersonalExercise } from "@evolyfoot/domain";
import type { PersonalExercise, PersonalExerciseInput } from "@evolyfoot/domain";
import { EducatorNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, PersonalExerciseRepository } from "./repositories";

export class PersonalExerciseService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly personalExerciseRepository: PersonalExerciseRepository,
  ) {}

  async list(educatorId: string): Promise<PersonalExercise[]> {
    return this.personalExerciseRepository.listByEducator(educatorId);
  }

  async add(educatorId: string, input: PersonalExerciseInput): Promise<PersonalExercise> {
    const error = validatePersonalExercise(input);
    if (error) {
      throw new ValidationError(error);
    }
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    const existing = await this.personalExerciseRepository.listByEducator(educatorId);
    if (existing.length >= personalExerciseMaxPerEducator) {
      throw new ValidationError(`Ta bibliothèque est limitée à ${personalExerciseMaxPerEducator} exercices.`);
    }
    return this.personalExerciseRepository.create(educatorId, { ...input, title: input.title.trim() });
  }

  async remove(educatorId: string, id: string): Promise<void> {
    await this.personalExerciseRepository.remove(id, educatorId);
  }
}
