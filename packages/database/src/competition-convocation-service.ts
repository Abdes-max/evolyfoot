import { concernedPlayers, createAttendanceEntry, isConcerned, playersWithoutResponse } from "@evolyfoot/domain";
import type { AttendanceStatus } from "@evolyfoot/domain";
import {
  cancellationNoteMaxLength,
  convocationRecipients,
  everyoneAnsweredMessage,
  type ConvocationOptions,
  type ConvocationResult,
} from "./convocation-service";
import { EducatorNotFoundError, PlateauNotFoundError, TournamentNotFoundError, ValidationError } from "./errors";
import type {
  CompetitionUpdate,
  EducatorRepository,
  MessageRepository,
  PersistedPlateau,
  PersistedTournament,
  PlateauRepository,
  PlayerRepository,
  TournamentRepository,
} from "./repositories";

export type CompetitionKind = "tournament" | "plateau";

const kindLabels: Record<CompetitionKind, string> = { tournament: "tournoi", plateau: "plateau" };

// Convocation d'un tournoi ou d'un plateau et réponses des joueurs concernés : même principe que
// les séances (ConvocationService.sendForTrainingSession, PlayerRsvpService), sans présence par
// défaut : chaque joueur répond.
export class CompetitionConvocationService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly tournamentRepository: Pick<TournamentRepository, "findById" | "update">,
    private readonly plateauRepository: Pick<PlateauRepository, "findById" | "update">,
    private readonly messageRepository: MessageRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async send(educatorId: string, kind: CompetitionKind, competitionId: string, options: ConvocationOptions = {}): Promise<ConvocationResult> {
    const [educator, competition] = await Promise.all([this.educatorRepository.findById(educatorId), this.find(kind, competitionId, educatorId)]);
    if (!educator) {
      throw new EducatorNotFoundError();
    }
    if (competition.cancelledAt) {
      throw new ValidationError(`Ce ${kindLabels[kind]} est annulé : rétablis-le pour envoyer la convocation.`);
    }
    const everyone = concernedPlayers(await this.playerRepository.listByEducator(educatorId), competition.selectedPlayerIds);
    if (everyone.length === 0) {
      throw new ValidationError("Coche les joueurs concernés avant d’envoyer la convocation.");
    }
    const convoked = options.onlyPending ? playersWithoutResponse(everyone, competition.attendance) : everyone;
    if (convoked.length === 0) {
      throw new ValidationError(everyoneAnsweredMessage);
    }
    const when = competition.dateLabel;
    const where = competition.location ? ` — ${competition.location}` : "";
    const reminder = options.onlyPending ? "Rappel — " : "";
    const text = `${reminder}Convocation : ${kindLabels[kind]} « ${competition.name} », ${when}${where}. Merci de répondre présent ou absent dans l'appli.`;
    await Promise.all(
      convoked.map((player) => this.messageRepository.create({ educatorId, playerId: player.id, authorRole: "coach", authorName: educator.displayName, text })),
    );
    await this.update(kind, competitionId, educatorId, { convokedAt: this.now() });
    return {
      sentCount: convoked.length,
      subject: `Convocation : ${kindLabels[kind]} « ${competition.name} »`,
      text,
      recipients: await convocationRecipients(this.educatorRepository, convoked),
    };
  }

  // Annule le tournoi ou le plateau et prévient les joueurs concernés par message (avec la raison, si elle est donnée).
  // Sans convocation envoyée, les joueurs ne savent pas qu'il existe : il est annulé sans message.
  async cancel(educatorId: string, kind: CompetitionKind, competitionId: string, note?: string | null): Promise<ConvocationResult> {
    const [educator, competition] = await Promise.all([this.educatorRepository.findById(educatorId), this.find(kind, competitionId, educatorId)]);
    if (!educator) {
      throw new EducatorNotFoundError();
    }
    if (competition.cancelledAt) {
      throw new ValidationError(`Ce ${kindLabels[kind]} est déjà annulé.`);
    }
    const reason = note?.trim() ? note.trim() : null;
    if (reason && reason.length > cancellationNoteMaxLength) {
      throw new ValidationError(`La raison est trop longue (${cancellationNoteMaxLength} caractères au plus).`);
    }
    const where = competition.location ? ` — ${competition.location}` : "";
    const text = `Annulation : le ${kindLabels[kind]} « ${competition.name} » (${competition.dateLabel}${where}) est annulé.${reason ? ` ${reason}` : ""}`;
    const roster = competition.convokedAt ? concernedPlayers(await this.playerRepository.listByEducator(educatorId), competition.selectedPlayerIds) : [];
    await Promise.all(
      roster.map((player) => this.messageRepository.create({ educatorId, playerId: player.id, authorRole: "coach", authorName: educator.displayName, text })),
    );
    await this.update(kind, competitionId, educatorId, { cancelledAt: this.now(), cancellationNote: reason });
    return {
      sentCount: roster.length,
      subject: `Annulation : ${kindLabels[kind]} « ${competition.name} »`,
      text,
      recipients: await convocationRecipients(this.educatorRepository, roster),
    };
  }

  // Rétablit un tournoi ou un plateau annulé, sans nouveau message.
  async restore(educatorId: string, kind: CompetitionKind, competitionId: string): Promise<void> {
    if (!(await this.educatorRepository.findById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    await this.find(kind, competitionId, educatorId);
    await this.update(kind, competitionId, educatorId, { cancelledAt: null, cancellationNote: null });
  }

  // Réponse d'un compte joueur, lue et écrite via l'éducateur propriétaire du joueur (même principe
  // que PlayerRsvpService). Un joueur non concerné ne voit pas l'événement : introuvable pour lui.
  async respond(playerAccountId: string, kind: CompetitionKind, competitionId: string, status: AttendanceStatus, comment?: string | null): Promise<void> {
    const account = await this.educatorRepository.findById(playerAccountId);
    if (!account || account.role !== "player" || !account.linkedPlayerId) {
      throw new EducatorNotFoundError();
    }
    const playerId = account.linkedPlayerId;
    const owned = await this.playerRepository.findAnyById(playerId);
    if (!owned) {
      throw new EducatorNotFoundError();
    }
    const competition = await this.find(kind, competitionId, owned.educatorId).catch(() => null);
    if (!competition || !isConcerned(competition.selectedPlayerIds, playerId)) {
      throw new EducatorNotFoundError();
    }
    if (competition.cancelledAt) {
      throw new ValidationError(`Ce ${kindLabels[kind]} est annulé.`);
    }
    if (competition.convokedAt === null) {
      throw new ValidationError(`La convocation de ce ${kindLabels[kind]} n’est pas encore envoyée.`);
    }
    const attendance = (competition.attendance ?? []).filter((entry) => entry.playerId !== playerId);
    attendance.push(createAttendanceEntry(playerId, owned.name, status, status === "present" ? null : comment));
    await this.update(kind, competitionId, owned.educatorId, { attendance });
  }

  private async find(kind: CompetitionKind, id: string, educatorId: string): Promise<PersistedTournament | PersistedPlateau> {
    const competition =
      kind === "tournament" ? await this.tournamentRepository.findById(id, educatorId) : await this.plateauRepository.findById(id, educatorId);
    if (!competition) {
      throw kind === "tournament" ? new TournamentNotFoundError() : new PlateauNotFoundError();
    }
    return competition;
  }

  private async update(kind: CompetitionKind, id: string, educatorId: string, input: CompetitionUpdate): Promise<void> {
    if (kind === "tournament") {
      await this.tournamentRepository.update(id, educatorId, input);
    } else {
      await this.plateauRepository.update(id, educatorId, input);
    }
  }
}
