import { PlayerNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, PlayerFollowerRepository, PlayerRepository } from "./repositories";

export interface TutorSummary {
  accountId: string;
  displayName: string;
  email: string;
  since: Date;
}

export interface TutorRequestSummary {
  id: string;
  displayName: string;
  email: string;
  createdAt: Date;
}

export interface PlayerTutors {
  tutors: TutorSummary[];
  requests: TutorRequestSummary[];
}

// Côté éducateur : comptes tuteur/joueur associés à un joueur de son effectif, et demandes faites par
// le lien d'invitation, à accepter ou refuser. Un compte n'a accès à l'enfant qu'une fois accepté.
export class TutorService {
  constructor(
    private readonly educatorRepository: Pick<EducatorRepository, "findById">,
    private readonly playerRepository: Pick<PlayerRepository, "findById">,
    private readonly followerRepository: PlayerFollowerRepository,
  ) {}

  private async ownedPlayer(educatorId: string, playerId: string) {
    const player = await this.playerRepository.findById(playerId, educatorId);
    if (!player) {
      throw new PlayerNotFoundError();
    }
    return player;
  }

  async list(educatorId: string, playerId: string): Promise<PlayerTutors> {
    await this.ownedPlayer(educatorId, playerId);
    const [tutors, requests] = await Promise.all([this.followerRepository.listFollowers(playerId), this.followerRepository.listRequests(playerId)]);
    return {
      tutors,
      requests: requests.map((request) => ({
        id: request.id,
        displayName: request.account.displayName,
        email: request.account.email,
        createdAt: request.createdAt,
      })),
    };
  }

  async answer(educatorId: string, playerId: string, requestId: string, accept: boolean): Promise<PlayerTutors> {
    await this.ownedPlayer(educatorId, playerId);
    const request = await this.followerRepository.findRequest(requestId);
    if (!request || request.playerId !== playerId) {
      throw new ValidationError("Cette demande n’existe plus.");
    }
    if (accept) {
      await this.followerRepository.follow(request.accountId, playerId);
      // Premier enfant accepté : il devient l'enfant affiché du compte.
      const followed = await this.followerRepository.followedPlayerIds(request.accountId);
      if (followed.length === 1) {
        await this.followerRepository.setDisplayedPlayer(request.accountId, playerId);
      }
    }
    await this.followerRepository.deleteRequest(requestId);
    return this.list(educatorId, playerId);
  }

  // Retire l'accès d'un compte à ce joueur ; s'il l'affichait, il passe à un autre enfant suivi.
  async remove(educatorId: string, playerId: string, accountId: string): Promise<PlayerTutors> {
    await this.ownedPlayer(educatorId, playerId);
    await this.followerRepository.unfollow(accountId, playerId);
    const account = await this.educatorRepository.findById(accountId);
    if (account?.linkedPlayerId === playerId) {
      const remaining = await this.followerRepository.followedPlayerIds(accountId);
      await this.followerRepository.setDisplayedPlayer(accountId, remaining[0] ?? null);
    }
    return this.list(educatorId, playerId);
  }
}
