import { EducatorNotFoundError, PlayerNotFoundError } from "./errors";
import { InviteInvalidError } from "./player-invite-service";
import { hashSessionToken } from "./session-token";
import type { EducatorRepository, PlayerFollowerRepository, PlayerInviteRepository, PlayerRepository, TeamRepository } from "./repositories";

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

  // Change l’enfant affiché ; refuse un enfant que ce compte ne suit pas.
  async select(accountId: string, playerId: string): Promise<void> {
    await this.playerAccount(accountId);
    const followed = await this.followerRepository.followedPlayerIds(accountId);
    if (!followed.includes(playerId)) {
      throw new PlayerNotFoundError();
    }
    await this.followerRepository.setDisplayedPlayer(accountId, playerId);
  }

  // Un tuteur déjà inscrit accepte l’invitation d’un autre enfant (ou d’un enfant déjà suivi par
  // l’autre parent) avec son compte existant : l’enfant rejoint ses enfants suivis et devient
  // l’enfant affiché.
  async attachInvite(accountId: string, token: string): Promise<void> {
    await this.playerAccount(accountId);
    const invite = await this.playerInviteRepository.findByTokenHash(hashSessionToken(token));
    if (!invite || invite.consumedAt || invite.expiresAt.getTime() <= this.now().getTime()) {
      throw new InviteInvalidError();
    }
    const player = await this.playerRepository.findById(invite.playerId, invite.educatorId);
    if (!player) {
      throw new PlayerNotFoundError();
    }
    await this.followerRepository.follow(accountId, invite.playerId);
    await this.followerRepository.setDisplayedPlayer(accountId, invite.playerId);
    await this.playerInviteRepository.markConsumed(invite.id);
  }
}
