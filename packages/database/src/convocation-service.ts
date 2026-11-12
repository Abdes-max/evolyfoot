import { concernedPlayers, createAttendanceEntry, playersWithoutResponse } from "@evolyfoot/domain";
import { EducatorNotFoundError, MatchNotFoundError, TrainingSessionNotFoundError, ValidationError } from "./errors";
import { matchMeetingTime } from "./match-time";
import type {
  EducatorRepository,
  MatchRepository,
  MessageRepository,
  PersistedMatch,
  PersistedPlayer,
  PersistedTrainingSession,
  PlayerRepository,
  TrainingSessionRepository,
} from "./repositories";
import type { TrainingConvocationRepository } from "./training-convocation-repository";

// Adresse à prévenir aussi par e-mail : celle de la fiche joueur (saisie par l'éducateur) et celle
// du compte EvolyFoot Player lié au joueur, sans doublon.
export interface ConvocationRecipient {
  email: string;
  name: string;
}

// `onlyPending` : relance seulement les joueurs concernés qui n'ont pas encore répondu.
export interface ConvocationOptions {
  onlyPending?: boolean;
}

export const everyoneAnsweredMessage = "Tous les joueurs concernés ont déjà répondu.";

export interface ConvocationResult {
  sentCount: number;
  subject: string;
  text: string;
  recipients: ConvocationRecipient[];
}

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
  return session.meetingAt ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: clubTimeZone }).format(session.meetingAt) : null;
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
  // Sans le titre de la séance : le joueur n'a pas à connaître son contenu.
  return `Convocation : entraînement, ${when}${where}. Merci de répondre présent ou absent dans l'appli.`;
}

export const cancellationNoteMaxLength = 300;

// « Annulation : l'entraînement du mardi 10 novembre · 18:00 — Stade est annulé. » suivi de la raison, si le coach en donne une.
function trainingSessionCancellationText(session: PersistedTrainingSession, note: string | null): string {
  const time = trainingSessionMeetingTime(session);
  const when = time ? `${trainingSessionDateLabel(session)} · ${time}` : trainingSessionDateLabel(session);
  const where = session.location ? ` — ${session.location}` : "";
  return `Annulation : l'entraînement du ${when}${where} est annulé.${note ? ` ${note}` : ""}`;
}

// Adresses e-mail à prévenir pour ces joueurs : celles des comptes qui les suivent et celle de la
// fiche joueur, sans doublon.
export async function convocationRecipients(
  educatorRepository: Pick<EducatorRepository, "findFollowers">,
  players: readonly PersistedPlayer[],
): Promise<ConvocationRecipient[]> {
  const followers = await Promise.all(players.map((player) => educatorRepository.findFollowers(player.id)));
  const byEmail = new Map<string, ConvocationRecipient>();
  players.forEach((player, index) => {
    for (const candidate of [
      ...(followers[index] ?? []).map((account) => ({ email: account.email, name: account.displayName })),
      player.email ? { email: player.email, name: player.firstName } : null,
    ]) {
      const key = candidate?.email.trim().toLowerCase();
      if (candidate && key && key.includes("@") && !byEmail.has(key)) {
        byEmail.set(key, { email: candidate.email.trim(), name: candidate.name });
      }
    }
  });
  return [...byEmail.values()];
}

// Envoie un message de convocation (via MessagingService, même fil que la messagerie normale) à
// tous les joueurs concernés par un événement -- ceux cochés pour un match, les joueurs des
// entraînements pour une séance (voir concerned-players.ts côté domaine).
// Pas de suivi "déjà envoyée" : renvoyer la convocation (composition modifiée, rappel...) est un
// geste volontaire du coach, pas une erreur à empêcher.
export class ConvocationService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly matchRepository: MatchRepository,
    private readonly trainingSessionRepository: TrainingSessionRepository,
    private readonly messageRepository: MessageRepository,
    // Réglage de l'équipe (présent par défaut) ; absent, la séance est convoquée sans réponse posée.
    private readonly convocationRepository?: Pick<TrainingConvocationRepository, "findSettings">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async sendForMatch(educatorId: string, matchId: string, options: ConvocationOptions = {}): Promise<ConvocationResult> {
    const [educator, match] = await Promise.all([this.educatorRepository.findById(educatorId), this.matchRepository.findById(matchId, educatorId)]);
    if (!educator) {
      throw new EducatorNotFoundError();
    }
    if (!match) {
      throw new MatchNotFoundError();
    }
    if (match.cancelledAt) {
      throw new ValidationError("Ce match est annulé : rétablis-le pour envoyer la convocation.");
    }
    const everyone = concernedPlayers(await this.playerRepository.listByEducator(educatorId), match.selectedPlayerIds);
    if (everyone.length === 0) {
      throw new ValidationError("Coche les joueurs concernés avant d’envoyer la convocation.");
    }
    const convoked = options.onlyPending ? playersWithoutResponse(everyone, match.attendance) : everyone;
    if (convoked.length === 0) {
      throw new ValidationError(everyoneAnsweredMessage);
    }
    const text = options.onlyPending ? `Rappel — ${matchConvocationText(match)}` : matchConvocationText(match);
    await Promise.all(
      convoked.map((player) => this.messageRepository.create({ educatorId, playerId: player.id, authorRole: "coach", authorName: educator.displayName, text })),
    );
    await this.matchRepository.update(matchId, educatorId, { convokedAt: this.now() });
    return {
      sentCount: convoked.length,
      subject: `Convocation : match contre ${match.opponent}`,
      text,
      recipients: await convocationRecipients(this.educatorRepository, convoked),
    };
  }

  async sendForTrainingSession(educatorId: string, sessionId: string): Promise<ConvocationResult> {
    const [educator, session, fullRoster, settings] = await Promise.all([
      this.educatorRepository.findById(educatorId),
      this.trainingSessionRepository.findById(sessionId, educatorId),
      this.playerRepository.listByEducator(educatorId),
      this.convocationRepository?.findSettings(educatorId),
    ]);
    // Seuls les joueurs des entraînements sont convoqués (tout l'effectif sans réglage).
    const roster = concernedPlayers(fullRoster, settings?.playerIds);
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
      roster.map((player) => this.messageRepository.create({ educatorId, playerId: player.id, authorRole: "coach", authorName: educator.displayName, text })),
    );
    // La séance passe de « programmée » à « convoquée » ; en « présent par défaut », chaque joueur
    // qui n'a pas encore répondu est compté présent jusqu'à ce qu'il signale son absence.
    const answered = new Set((session.attendance ?? []).map((entry) => entry.playerId));
    const attendance =
      settings?.attendanceDefault === "present"
        ? [
            ...(session.attendance ?? []),
            ...roster
              .filter((player) => !answered.has(player.id))
              .map((player) => Object.freeze({ ...createAttendanceEntry(player.id, player.name, "present"), byDefault: true })),
          ]
        : undefined;
    await this.trainingSessionRepository.update(sessionId, educatorId, { convokedAt: this.now(), ...(attendance ? { attendance } : {}) });
    return {
      sentCount: roster.length,
      subject: "Convocation : entraînement",
      text,
      recipients: await convocationRecipients(this.educatorRepository, roster),
    };
  }

  // Annule le match et prévient les joueurs concernés par message (avec la raison, si elle est donnée). Un match joué ne
  // s'annule pas ; sans convocation envoyée, il est annulé sans message.
  async cancelMatch(educatorId: string, matchId: string, note?: string | null): Promise<ConvocationResult> {
    const [educator, match] = await Promise.all([this.educatorRepository.findById(educatorId), this.matchRepository.findById(matchId, educatorId)]);
    if (!educator) {
      throw new EducatorNotFoundError();
    }
    if (!match) {
      throw new MatchNotFoundError();
    }
    if (match.cancelledAt) {
      throw new ValidationError("Ce match est déjà annulé.");
    }
    if (match.status === "played") {
      throw new ValidationError("Un match déjà joué ne peut pas être annulé.");
    }
    const reason = note?.trim() ? note.trim() : null;
    if (reason && reason.length > cancellationNoteMaxLength) {
      throw new ValidationError(`La raison est trop longue (${cancellationNoteMaxLength} caractères au plus).`);
    }
    const time = matchMeetingTime(match.date, match.meetingOffsetMinutes, match.meetingTime);
    const when = time ? `${match.dateLabel} · ${time}` : match.dateLabel;
    const where = match.location ? ` — ${match.location}` : "";
    const text = `Annulation : le match contre ${match.opponent} (${when}${where}) est annulé.${reason ? ` ${reason}` : ""}`;
    const roster = match.convokedAt ? concernedPlayers(await this.playerRepository.listByEducator(educatorId), match.selectedPlayerIds) : [];
    await Promise.all(
      roster.map((player) => this.messageRepository.create({ educatorId, playerId: player.id, authorRole: "coach", authorName: educator.displayName, text })),
    );
    await this.matchRepository.update(matchId, educatorId, { cancelledAt: this.now(), cancellationNote: reason });
    return {
      sentCount: roster.length,
      subject: `Annulation : match contre ${match.opponent}`,
      text,
      recipients: await convocationRecipients(this.educatorRepository, roster),
    };
  }

  // Rétablit un match annulé, sans nouveau message.
  async restoreMatch(educatorId: string, matchId: string): Promise<void> {
    if (!(await this.educatorRepository.findById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    await this.matchRepository.update(matchId, educatorId, { cancelledAt: null, cancellationNote: null });
  }

  // Annule l'entraînement et prévient les joueurs concernés par message (avec la raison, si elle est donnée). Sans
  // convocation envoyée, les joueurs ne savent pas qu'il existe : il est annulé sans message.
  async cancelTrainingSession(educatorId: string, sessionId: string, note?: string | null): Promise<ConvocationResult> {
    const [educator, session, fullRoster, settings] = await Promise.all([
      this.educatorRepository.findById(educatorId),
      this.trainingSessionRepository.findById(sessionId, educatorId),
      this.playerRepository.listByEducator(educatorId),
      this.convocationRepository?.findSettings(educatorId),
    ]);
    if (!educator) {
      throw new EducatorNotFoundError();
    }
    if (!session) {
      throw new TrainingSessionNotFoundError();
    }
    if (session.cancelledAt) {
      throw new ValidationError("Cet entraînement est déjà annulé.");
    }
    const reason = note?.trim() ? note.trim() : null;
    if (reason && reason.length > cancellationNoteMaxLength) {
      throw new ValidationError(`La raison est trop longue (${cancellationNoteMaxLength} caractères au plus).`);
    }
    const text = trainingSessionCancellationText(session, reason);
    const roster = session.convokedAt ? concernedPlayers(fullRoster, settings?.playerIds) : [];
    await Promise.all(
      roster.map((player) => this.messageRepository.create({ educatorId, playerId: player.id, authorRole: "coach", authorName: educator.displayName, text })),
    );
    await this.trainingSessionRepository.update(sessionId, educatorId, { cancelledAt: this.now(), cancellationNote: reason });
    return {
      sentCount: roster.length,
      subject: "Annulation : entraînement",
      text,
      recipients: await convocationRecipients(this.educatorRepository, roster),
    };
  }

  // Rétablit un entraînement annulé, sans nouveau message : le coach peut renvoyer la convocation s'il le souhaite.
  async restoreTrainingSession(educatorId: string, sessionId: string): Promise<void> {
    if (!(await this.educatorRepository.findById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    await this.trainingSessionRepository.update(sessionId, educatorId, { cancelledAt: null, cancellationNote: null });
  }
}
