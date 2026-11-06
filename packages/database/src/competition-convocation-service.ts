import { concernedPlayers, createAttendanceEntry, isConcerned } from "@evolyfoot/domain";
import type { AttendanceStatus } from "@evolyfoot/domain";
import { convocationRecipients, type ConvocationResult } from "./convocation-service";
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

  async send(educatorId: string, kind: CompetitionKind, competitionId: string): Promise<ConvocationResult> {
    const [educator, competition] = await Promise.all([this.educatorRepository.findById(educatorId), this.find(kind, competitionId, educatorId)]);
    if (!educator) {
      throw new EducatorNotFoundError();
    }
    const convoked = concernedPlayers(await this.playerRepository.listByEducator(educatorId), competition.selectedPlayerIds);
    if (convoked.length === 0) {
      throw new ValidationError("Coche les joueurs concernés avant d’envoyer la convocation.");
    }
    const when = competition.dateLabel;
    const where = competition.location ? ` — ${competition.location}` : "";
    const text = `Convocation : ${kindLabels[kind]} « ${competition.name} », ${when}${where}. Merci de répondre présent ou absent dans l'appli.`;
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
