import { completeObservation } from "@evolyfoot/domain";
import type { ObservationDraft } from "@evolyfoot/domain";
import { EducatorNotFoundError, ObservationNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, ObservationRepository, PersistedObservation } from "./repositories";

export class ObservationService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly observationRepository: ObservationRepository,
  ) {}

  async list(educatorId: string): Promise<PersistedObservation[]> {
    return this.observationRepository.listByEducator(educatorId);
  }

  async get(educatorId: string, observationId: string): Promise<PersistedObservation> {
    const observation = await this.observationRepository.findById(observationId, educatorId);
    if (!observation) {
      throw new ObservationNotFoundError();
    }
    return observation;
  }

  async save(educatorId: string, draft: ObservationDraft, matchId?: string): Promise<PersistedObservation> {
    // Recalcule le rapport (synthèse comprise) côté serveur à partir du brouillon plutôt que
    // de faire confiance à une synthèse déjà calculée côté client.
    let report;
    try {
      report = completeObservation(draft);
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : "Observation incomplète.");
    }

    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }

    return this.observationRepository.create(educatorId, report, matchId);
  }
}
