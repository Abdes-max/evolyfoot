import { EducatorNotFoundError, PlayerNotFoundError, ValidationError } from "./errors";
import type { FollowRequestNotice } from "./notification-service";
import { InviteInvalidError } from "./player-invite-service";
import { hashSessionToken } from "./session-token";
import type { EducatorRepository, PlayerFollowerRepository, PlayerInviteRepository, PlayerRepository, TeamRepository } from "./repositories";

// Même plafond que la photo posée par l’éducateur (RosterService).
const maxPhotoLength = 700_000;

// Enfant dont la demande de suivi attend l'accord de l'éducateur.
export interface PendingChild {
  playerId: string;
  name: string;
  teamName: string | null;
  coachName: string | null;
}

export interface FollowedChild {
  playerId: string;
  name: string;
  photo: string | null;
  teamName: string | null;
  // Enfant affiché : celui dont l’appli montre la carte, le calendrier et la discussion.
  displayed: boolean;
}

// Enfants suivis par un compte tuteur/joueur : un compte peut en suivre plusieurs (une discussion
// par enfant) et un enfant peut être suivi par plusieurs comptes (les deux parents). Le compte ne
// désigne jamais un enfant qu’il ne suit pas : chaque action vérifie le lien.
export class PlayerChildrenService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly followerRepository: PlayerFollowerRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly teamRepository: TeamRepository,
    private readonly playerInviteRepository: PlayerInviteRepository,
    private readonly now: () => Date = () => new Date(),
    // Prévient l'éducateur d'une nouvelle demande (voir PlayerInviteService).
    private readonly notifyRequest: (notice: FollowRequestNotice) => Promise<void> = async () => undefined,
  ) {}

  private async playerAccount(accountId: string) {
    const account = await this.educatorRepository.findById(accountId);
    if (!account || account.role !== "player") {
      throw new EducatorNotFoundError();
    }
    return account;
  }

  async list(accountId: string): Promise<FollowedChild[]> {
    const account = await this.playerAccount(accountId);
    const playerIds = await this.followerRepository.followedPlayerIds(accountId);
    const children = await Promise.all(
      playerIds.map(async (playerId) => {
        const player = await this.playerRepository.findAnyById(playerId);
        if (!player) return null;
        const team = await this.teamRepository.findForEducator(player.educatorId);
        return {
          playerId,
          name: player.name,
          photo: player.photo ?? null,
          teamName: team?.profile.name ?? null,
          displayed: playerId === account.linkedPlayerId,
        };
      }),
    );
    return children.filter((child): child is FollowedChild => child !== null);
  }

  async pending(accountId: string): Promise<PendingChild[]> {
    await this.playerAccount(accountId);
    const playerIds = await this.followerRepository.pendingPlayerIds(accountId);
    const children = await Promise.all(
      playerIds.map(async (playerId) => {
        const player = await this.playerRepository.findAnyById(playerId);
        if (!player) return null;
        const [team, coach] = await Promise.all([this.teamRepository.findForEducator(player.educatorId), this.educatorRepository.findById(player.educatorId)]);
        return { playerId, name: player.name, teamName: team?.profile.name ?? null, coachName: coach?.displayName ?? null };
      }),
    );
    return children.filter((child): child is PendingChild => child !== null);
  }

  // Change l’enfant affiché ; refuse un enfant que ce compte ne suit pas.
  async select(accountId: string, playerId: string): Promise<void> {
    await this.playerAccount(accountId);
    const followed = await this.followerRepository.followedPlayerIds(accountId);
    if (!followed.includes(playerId)) {
      throw new PlayerNotFoundError();
    }
    await this.followerRepository.setDisplayedPlayer(accountId, playerId);
  }

  // Un tuteur déjà inscrit utilise l’invitation d’un autre enfant avec son compte existant : une
  // demande part à l’éducateur, l’enfant rejoint ses enfants suivis quand elle est acceptée.
  async attachInvite(accountId: string, token: string): Promise<void> {
    const account = await this.playerAccount(accountId);
    const invite = await this.playerInviteRepository.findByTokenHash(hashSessionToken(token));
    if (!invite || invite.consumedAt || invite.expiresAt.getTime() <= this.now().getTime()) {
      throw new InviteInvalidError();
    }
    const player = await this.playerRepository.findById(invite.playerId, invite.educatorId);
    if (!player) {
      throw new PlayerNotFoundError();
    }
    if (!(await this.followerRepository.followedPlayerIds(accountId)).includes(invite.playerId)) {
      await this.followerRepository.requestFollow(accountId, invite.playerId);
      await this.notifyRequest({ educatorId: invite.educatorId, playerId: invite.playerId, playerName: player.name, accountName: account.displayName }).catch(
        () => undefined,
      );
    }
  }

  // Le joueur (ou son tuteur) change la photo de l’enfant affiché : la même que voit l’éducateur.
  async setPhoto(accountId: string, photo: string | null): Promise<void> {
    const account = await this.playerAccount(accountId);
    const playerId = account.linkedPlayerId;
    if (!playerId || !(await this.followerRepository.followedPlayerIds(accountId)).includes(playerId)) {
      throw new PlayerNotFoundError();
    }
    if (photo !== null && (!photo.startsWith("data:image/") || photo.length > maxPhotoLength)) {
      throw new ValidationError("La photo est invalide ou trop lourde.");
    }
    const player = await this.playerRepository.findAnyById(playerId);
    if (!player) {
      throw new PlayerNotFoundError();
    }
    await this.playerRepository.update(playerId, player.educatorId, { photo });
  }
}
