import { validateMessageText } from "@evolyfoot/domain";
import { EducatorNotFoundError, PlayerNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, MessageRepository, PersistedMessage, PlayerRepository } from "./repositories";

// Fil de discussion coach <-> joueur/tuteur, un seul fil par joueur (voir Message côté domaine).
// `authorName` n'est jamais fourni par l'appelant : dérivé du compte authentifié (coach ou
// joueur/tuteur), même principe que AttendanceEntry qui duplique playerName depuis le joueur
// possédé plutôt que depuis une valeur client.
export class MessagingService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly messageRepository: MessageRepository,
  ) {}

  async listForCoach(educatorId: string, playerId: string): Promise<PersistedMessage[]> {
    const player = await this.playerRepository.findById(playerId, educatorId);
    if (!player) {
      throw new PlayerNotFoundError();
    }
    return this.messageRepository.listByPlayer(educatorId, playerId);
  }

  async sendAsCoach(educatorId: string, playerId: string, text: string): Promise<PersistedMessage> {
    const [educator, player] = await Promise.all([
      this.educatorRepository.findById(educatorId),
      this.playerRepository.findById(playerId, educatorId),
    ]);
    if (!educator) {
      throw new EducatorNotFoundError();
    }
    if (!player) {
      throw new PlayerNotFoundError();
    }
    const error = validateMessageText(text);
    if (error) {
      throw new ValidationError(error);
    }
    return this.messageRepository.create({ educatorId, playerId, authorRole: "coach", authorName: educator.displayName, text: text.trim() });
  }

  // Résout un compte "player" (joueur/tuteur) vers le joueur qu'il suit et l'éducateur
  // PROPRIÉTAIRE de ce joueur -- jamais l'inverse, même principe que PlayerRsvpService.
  private async resolvePlayerAccount(playerAccountId: string): Promise<{ playerId: string; educatorId: string; authorName: string }> {
    const account = await this.educatorRepository.findById(playerAccountId);
    if (!account || account.role !== "player" || !account.linkedPlayerId) {
      throw new EducatorNotFoundError();
    }
    const owned = await this.playerRepository.findAnyById(account.linkedPlayerId);
    if (!owned) {
      throw new EducatorNotFoundError();
    }
    return { playerId: owned.id, educatorId: owned.educatorId, authorName: account.displayName };
  }

  async listForPlayerAccount(playerAccountId: string): Promise<PersistedMessage[]> {
    const { playerId, educatorId } = await this.resolvePlayerAccount(playerAccountId);
    return this.messageRepository.listByPlayer(educatorId, playerId);
  }

  async sendAsPlayerAccount(playerAccountId: string, text: string): Promise<PersistedMessage> {
    const { playerId, educatorId, authorName } = await this.resolvePlayerAccount(playerAccountId);
    const error = validateMessageText(text);
    if (error) {
      throw new ValidationError(error);
    }
    return this.messageRepository.create({ educatorId, playerId, authorRole: "player", authorName, text: text.trim() });
  }
}
