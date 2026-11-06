import type { AuthenticatedSession, AuthService } from "./auth-service";
import type { FollowRequestNotice } from "./notification-service";
import { normalizeEducatorEmail } from "./email";
import { PlayerNotFoundError, ValidationError } from "./errors";
import { hashPassword, validatePassword } from "./password";
import { generateSessionToken, hashSessionToken } from "./session-token";
import type { EducatorRepository, PlayerFollowerRepository, PlayerInviteRepository, PlayerRepository, TeamRepository } from "./repositories";

// Le lien reste le même tant que l'éducateur n'en demande pas un nouveau : chaque utilisation crée
// une demande à valider, il peut donc servir aux deux parents et être renvoyé.
const INVITE_DURATION_MS = 1000 * 60 * 60 * 24 * 365; // 1 an

export class PlayerAccountExistsError extends Error {
  constructor() {
    super("Un compte est déjà lié à ce joueur.");
    this.name = "PlayerAccountExistsError";
  }
}

export class InviteInvalidError extends Error {
  constructor(message = "Cette invitation n’est plus valide.") {
    super(message);
    this.name = "InviteInvalidError";
  }
}

export interface CreatedInvite {
  token: string; // en clair, renvoyé une seule fois
  expiresAt: Date;
}

export interface InvitePreview {
  playerName: string;
  teamName: string | null;
  coachName: string;
}

export class PlayerInviteService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly playerInviteRepository: PlayerInviteRepository,
    private readonly teamRepository: TeamRepository,
    private readonly authService: Pick<AuthService, "openSession">,
    private readonly followerRepository: Pick<PlayerFollowerRepository, "requestFollow">,
    // Prévient l'éducateur d'une nouvelle demande (notification et push) ; jamais bloquant.
    private readonly notifyRequest: (notice: FollowRequestNotice) => Promise<void> = async () => undefined,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // Lien d'invitation d'un joueur de l'effectif du coach : le même tant qu'il est valable, pour le
  // renvoyer à volonté ; `renew` le remplace (l'ancien ne marche plus, lien diffusé par erreur).
  async create(educatorId: string, playerId: string, options: { renew?: boolean } = {}): Promise<CreatedInvite> {
    const player = await this.playerRepository.findById(playerId, educatorId);
    if (!player) {
      throw new PlayerNotFoundError();
    }
    const now = this.now();
    if (!options.renew) {
      const current = await this.playerInviteRepository.findCurrentForPlayer(playerId, now);
      if (current?.token) {
        return { token: current.token, expiresAt: current.expiresAt };
      }
    } else {
      await this.playerInviteRepository.expireForPlayer(playerId, now);
    }
    const token = generateSessionToken();
    const expiresAt = new Date(now.getTime() + INVITE_DURATION_MS);
    await this.playerInviteRepository.create({ educatorId, playerId, tokenHash: hashSessionToken(token), token, expiresAt });
    return { token, expiresAt };
  }

  // Lien en cours pour ce joueur, sans en créer (affiché à l'ouverture de la fiche).
  async current(educatorId: string, playerId: string): Promise<CreatedInvite | null> {
    const player = await this.playerRepository.findById(playerId, educatorId);
    if (!player) {
      throw new PlayerNotFoundError();
    }
    const current = await this.playerInviteRepository.findCurrentForPlayer(playerId, this.now());
    return current?.token ? { token: current.token, expiresAt: current.expiresAt } : null;
  }

  // Infos publiques d'une invitation, sans la consommer (pour l'afficher sur /rejoindre/:token).
  async preview(token: string): Promise<InvitePreview | null> {
    const invite = await this.playerInviteRepository.findByTokenHash(hashSessionToken(token));
    if (!invite || invite.consumedAt || invite.expiresAt.getTime() <= this.now().getTime()) {
      return null;
    }
    const [player, coach, team] = await Promise.all([
      this.playerRepository.findById(invite.playerId, invite.educatorId),
      this.educatorRepository.findById(invite.educatorId),
      this.teamRepository.findForEducator(invite.educatorId),
    ]);
    if (!player || !coach) {
      return null;
    }
    return { playerName: player.name, teamName: team?.profile.name ?? null, coachName: coach.displayName };
  }

  // Crée le compte tuteur/joueur et ouvre sa session. Le compte ne voit rien de l'enfant tant que
  // l'éducateur n'a pas accepté sa demande (voir TutorService) ; le lien reste utilisable.
  async consume(token: string, input: { email: string; password: string; displayName: string }): Promise<AuthenticatedSession> {
    const invite = await this.playerInviteRepository.findByTokenHash(hashSessionToken(token));
    if (!invite || invite.consumedAt || invite.expiresAt.getTime() <= this.now().getTime()) {
      throw new InviteInvalidError();
    }
    let email: string;
    let password: string;
    try {
      email = normalizeEducatorEmail(input.email);
      password = validatePassword(input.password);
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : "Champ invalide.");
    }
    const displayName = input.displayName.trim();
    if (!displayName) {
      throw new ValidationError("Le nom est obligatoire.");
    }

    const player = await this.playerRepository.findById(invite.playerId, invite.educatorId);
    if (!player) {
      throw new PlayerNotFoundError();
    }
    const account = await this.educatorRepository.create({
      email,
      displayName,
      passwordHash: await hashPassword(password),
      role: "player",
    });
    await this.followerRepository.requestFollow(account.id, invite.playerId);
    await this.notifyRequest({ educatorId: invite.educatorId, playerId: invite.playerId, playerName: player.name, accountName: displayName }).catch(
      () => undefined,
    );
    return this.authService.openSession(account);
  }
}
