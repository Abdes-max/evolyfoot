import { createAttendanceEntry, isConcerned } from "@evolyfoot/domain";
import type { AttendanceStatus } from "@evolyfoot/domain";
import { EducatorNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, MatchRepository, PlayerRepository, TrainingSessionRepository } from "./repositories";
import type { TrainingConvocationRepository } from "./training-convocation-repository";

// Réponse du joueur/tuteur à sa convocation pour un match ou une séance à venir -- seule écriture
// ouverte à un compte "player" (le reste de son espace est en lecture seule, voir
// PlayerDashboardService). Toutes les données sont lues/écrites via l'éducateur PROPRIÉTAIRE du
// match/de la séance, jamais via le compte joueur lui-même, même principe que
// PlayerDashboardService.
export class PlayerRsvpService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly matchRepository: MatchRepository,
    private readonly trainingSessionRepository: TrainingSessionRepository,
    // Joueurs des entraînements ; absent, toute l'équipe peut répondre.
    private readonly convocationRepository?: Pick<TrainingConvocationRepository, "findSettings">,
  ) {}

  async respondToMatch(playerAccountId: string, matchId: string, status: AttendanceStatus, comment?: string | null): Promise<void> {
    const account = await this.educatorRepository.findById(playerAccountId);
    if (!account || account.role !== "player" || !account.linkedPlayerId) {
      throw new EducatorNotFoundError();
    }
    const playerId = account.linkedPlayerId;
    const owned = await this.playerRepository.findAnyById(playerId);
    if (!owned) {
      throw new EducatorNotFoundError();
    }
    const match = await this.matchRepository.findById(matchId, owned.educatorId);
    // Un joueur non concerné ne voit pas le match (voir PlayerDashboardService).
    if (!match || !isConcerned(match.selectedPlayerIds, playerId)) {
      throw new EducatorNotFoundError();
    }
    if (match.status !== "scheduled") {
      throw new ValidationError("Ce match a déjà eu lieu, la convocation n’est plus modifiable.");
    }

    // Le motif détaillé n'a de sens que pour une absence -- un commentaire laissé puis un
    // changement d'avis vers "Présent" ne doit pas laisser une justification obsolète affichée.
    const attendance = (match.attendance ?? []).filter((entry) => entry.playerId !== playerId);
    attendance.push(createAttendanceEntry(playerId, owned.name, status, status === "present" ? null : comment));
    await this.matchRepository.update(matchId, owned.educatorId, { attendance });
  }

  // Même principe que respondToMatch ci-dessus -- pas de blocage une fois la séance "passée" : à
  // la différence du match (`status`), une séance n'a pas d'état explicite pour ça, la présence
  // pouvant être (re)générée à tout moment par `TrainingSessionService.save`.
  async respondToTrainingSession(playerAccountId: string, sessionId: string, status: AttendanceStatus, comment?: string | null): Promise<void> {
    const account = await this.educatorRepository.findById(playerAccountId);
    if (!account || account.role !== "player" || !account.linkedPlayerId) {
      throw new EducatorNotFoundError();
    }
    const playerId = account.linkedPlayerId;
    const owned = await this.playerRepository.findAnyById(playerId);
    if (!owned) {
      throw new EducatorNotFoundError();
    }
    const [session, settings] = await Promise.all([
      this.trainingSessionRepository.findById(sessionId, owned.educatorId),
      this.convocationRepository?.findSettings(owned.educatorId),
    ]);
    if (!session || !isConcerned(settings?.playerIds, playerId)) {
      throw new EducatorNotFoundError();
    }
    if (session.convokedAt === null) {
      throw new ValidationError("La convocation de cette séance n’est pas encore envoyée.");
    }

    const attendance = (session.attendance ?? []).filter((entry) => entry.playerId !== playerId);
    attendance.push(createAttendanceEntry(playerId, owned.name, status, status === "present" ? null : comment));
    await this.trainingSessionRepository.update(sessionId, owned.educatorId, { attendance });
  }
}
