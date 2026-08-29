import { summarizeDiagnostic } from "@evolyfoot/domain";
import type { DiagnosticScores } from "@evolyfoot/domain";
import { DiagnosticNotFoundError, EducatorNotFoundError } from "./errors";
import type { DiagnosticRepository, EducatorRepository, PersistedDiagnostic } from "./repositories";

export class DiagnosticService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly diagnosticRepository: DiagnosticRepository,
  ) {}

  async save(educatorId: string, scores: DiagnosticScores): Promise<PersistedDiagnostic> {
    // Valide au passage (lève si un critère n'est pas noté de 1 à 4) : même garde-fou que
    // celui utilisé pour calculer les priorités affichées au coach.
    summarizeDiagnostic(scores);
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    return this.diagnosticRepository.upsertForEducator(educatorId, scores);
  }

  async get(educatorId: string): Promise<PersistedDiagnostic> {
    const diagnostic = await this.diagnosticRepository.findForEducator(educatorId);
    if (diagnostic === null) {
      throw new DiagnosticNotFoundError();
    }
    return diagnostic;
  }
}
