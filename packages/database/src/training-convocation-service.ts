import { convocationDue, isAttendanceDefault, isValidLeadDays, type TrainingConvocationSettings } from "@evolyfoot/domain";
import type { ConvocationResult, ConvocationService } from "./convocation-service";
import { ValidationError } from "./errors";
import { readPlayerSelection } from "./player-selection";
import type { PlayerRepository } from "./repositories";
import type { TrainingConvocationRepository } from "./training-convocation-repository";

export interface SentConvocation {
  educatorId: string;
  sessionId: string;
  outcome: ConvocationResult;
}

// Convocations aux entraînements : réglage de l'éducateur (quand les envoyer, réponse par défaut)
// et envoi automatique des convocations arrivées à échéance (voir le planificateur côté web).
export class TrainingConvocationService {
  constructor(
    private readonly repository: TrainingConvocationRepository,
    private readonly convocationService: Pick<ConvocationService, "sendForTrainingSession">,
    // Effectif, pour vérifier les joueurs des entraînements (voir readPlayerSelection).
    private readonly playerRepository?: Pick<PlayerRepository, "listByEducator">,
  ) {}

  getSettings(educatorId: string): Promise<TrainingConvocationSettings> {
    return this.repository.findSettings(educatorId);
  }

  async saveSettings(educatorId: string, input: { leadDays: unknown; attendanceDefault: unknown; playerIds?: unknown }): Promise<TrainingConvocationSettings> {
    if (!isValidLeadDays(input.leadDays)) {
      throw new ValidationError("Choisis quand envoyer les convocations.");
    }
    if (!isAttendanceDefault(input.attendanceDefault)) {
      throw new ValidationError("Choisis la réponse par défaut des joueurs.");
    }
    const playerIds = await readPlayerSelection(this.playerRepository, educatorId, input.playerIds);
    return this.repository.saveSettings(educatorId, {
      leadDays: input.leadDays,
      attendanceDefault: input.attendanceDefault,
      ...(playerIds !== undefined ? { playerIds } : {}),
    });
  }

  // Envoie chaque convocation arrivée à échéance ; une séance en échec est retentée au passage
  // suivant sans bloquer les autres.
  async sendDue(now: Date, log: (error: unknown) => void = () => undefined): Promise<SentConvocation[]> {
    const sent: SentConvocation[] = [];
    for (const awaiting of await this.repository.listAwaiting(now)) {
      if (!convocationDue(awaiting.meetingAt, awaiting.leadDays, now)) continue;
      try {
        sent.push({ ...awaiting, outcome: await this.convocationService.sendForTrainingSession(awaiting.educatorId, awaiting.sessionId) });
      } catch (error) {
        log(error);
      }
    }
    return sent;
  }
}
