import { EducatorNotFoundError, MatchNotFoundError, TrainingSessionNotFoundError, ValidationError } from "./errors";
import { matchMeetingTime } from "./match-time";
import type { EducatorRepository, MatchRepository, MessageRepository, PersistedMatch, PersistedTrainingSession, PlayerRepository, TrainingSessionRepository } from "./repositories";

// Fuseau du club plutôt que celui (souvent UTC) du serveur qui exécute ce code -- voir le même
// correctif dans match-time.ts.
const clubTimeZone = "Europe/Paris";

// "Samedi 19 septembre" -- même format que PlayerDashboardMatch, dupliqué ici plutôt que partagé
// (voir la même duplication assumée pour trainingSessionDateLabel côté PlayerDashboardService) :
// le message de convocation doit rester lisible même si la séance n'a pas encore de rendez-vous
// (créée avant que ce champ ne soit obligatoire).
function trainingSessionDateLabel(session: PersistedTrainingSession): string {
  if (session.meetingAt) {
    return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: clubTimeZone })
      .format(session.meetingAt)
      .replace(/^\p{L}/u, (letter) => letter.toUpperCase());
  }
  return `semaine ${session.weekNumber}`;
}

function trainingSessionMeetingTime(session: PersistedTrainingSession): string | null {
  return session.meetingAt
    ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: clubTimeZone }).format(session.meetingAt)
    : null;
}

function matchConvocationText(match: PersistedMatch): string {
  // Priorité au rendez-vous (l'heure à laquelle se présenter) plutôt qu'au coup d'envoi lui-même,
  // voir matchMeetingTime -- son repli sur le texte libre historique couvre le match créé avant
  // l'introduction de `date`/`meetingOffsetMinutes`.
  const time = matchMeetingTime(match.date, match.meetingOffsetMinutes, match.meetingTime);
  const when = time ? `${match.dateLabel} · ${time}` : match.dateLabel;
  const where = match.location ? ` — ${match.location}` : "";
  return `Convocation : match contre ${match.opponent}, ${when}${where}. Merci de répondre présent ou absent dans l'appli.`;
}

function trainingSessionConvocationText(session: PersistedTrainingSession): string {
  const time = trainingSessionMeetingTime(session);
  const when = time ? `${trainingSessionDateLabel(session)} · ${time}` : trainingSessionDateLabel(session);
  const where = session.location ? ` — ${session.location}` : "";
  return `Convocation : séance « ${session.title} », ${when}${where}. Merci de répondre présent ou absent dans l'appli.`;
}

// Envoie un message de convocation (via MessagingService, même fil que la messagerie normale) à
// tous les joueurs concernés par un événement -- la composition retenue pour un match, tout
// l'effectif pour une séance (qui n'a pas de composition, voir PlayerDashboardTrainingSession).
// Pas de suivi "déjà envoyée" : renvoyer la convocation (composition modifiée, rappel...) est un
// geste volontaire du coach, pas une erreur à empêcher.
export class ConvocationService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly matchRepository: MatchRepository,
    private readonly trainingSessionRepository: TrainingSessionRepository,
    private readonly messageRepository: MessageRepository,
  ) {}

  async sendForMatch(educatorId: string, matchId: string): Promise<{ sentCount: number }> {
    const [educator, match] = await Promise.all([
      this.educatorRepository.findById(educatorId),
      this.matchRepository.findById(matchId, educatorId),
    ]);
    if (!educator) {
      throw new EducatorNotFoundError();
    }
    if (!match) {
      throw new MatchNotFoundError();
    }
    const playerIds = [...new Set(match.lineup.map((assignment) => assignment.playerId))];
    if (playerIds.length === 0) {
      throw new ValidationError("Compose l’équipe avant d’envoyer la convocation.");
    }
    const text = matchConvocationText(match);
    await Promise.all(
      playerIds.map((playerId) =>
        this.messageRepository.create({ educatorId, playerId, authorRole: "coach", authorName: educator.displayName, text }),
      ),
    );
    return { sentCount: playerIds.length };
  }

  async sendForTrainingSession(educatorId: string, sessionId: string): Promise<{ sentCount: number }> {
    const [educator, session, roster] = await Promise.all([
      this.educatorRepository.findById(educatorId),
      this.trainingSessionRepository.findById(sessionId, educatorId),
      this.playerRepository.listByEducator(educatorId),
    ]);
    if (!educator) {
      throw new EducatorNotFoundError();
    }
    if (!session) {
      throw new TrainingSessionNotFoundError();
    }
    if (roster.length === 0) {
      throw new ValidationError("Ajoute des joueurs à l’effectif avant d’envoyer la convocation.");
    }
    const text = trainingSessionConvocationText(session);
    await Promise.all(
      roster.map((player) =>
        this.messageRepository.create({ educatorId, playerId: player.id, authorRole: "coach", authorName: educator.displayName, text }),
      ),
    );
    return { sentCount: roster.length };
  }
}
