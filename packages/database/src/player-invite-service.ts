import type { AuthenticatedSession, AuthService } from "./auth-service";
import { normalizeEducatorEmail } from "./email";
import { PlayerNotFoundError, ValidationError } from "./errors";
import { hashPassword, validatePassword } from "./password";
import { generateSessionToken, hashSessionToken } from "./session-token";
import type {
  EducatorRepository,
  PlayerInviteRepository,
  PlayerRepository,
  TeamRepository,
} from "./repositories";

const INVITE_DURATION_MS = 1000 * 60 * 60 * 24 * 14; // 14 jours

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
    private readonly now: () => Date = () => new Date(),
  ) {}

  // Génère une invitation pour un joueur de l'effectif du coach. Refuse si le joueur a déjà un
  // compte lié ou une invitation encore active.
  async create(educatorId: string, playerId: string): Promise<CreatedInvite> {
    const player = await this.playerRepository.findById(playerId, educatorId);
    if (!player) {
      throw new PlayerNotFoundError();
    }
    if (await this.educatorRepository.findByLinkedPlayerId(playerId)) {
      throw new PlayerAccountExistsError();
    }
    if (await this.playerInviteRepository.findActiveForPlayer(playerId)) {
      throw new InviteInvalidError("Une invitation est déjà active pour ce joueur.");
    }
    const token = generateSessionToken();
    const expiresAt = new Date(this.now().getTime() + INVITE_DURATION_MS);
    await this.playerInviteRepository.create({
      educatorId,
      playerId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    });
    return { token, expiresAt };
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

  // Crée le compte tuteur/joueur lié et ouvre sa session. Marque l'invitation consommée.
  async consume(
    token: string,
    input: { email: string; password: string; displayName: string },
  ): Promise<AuthenticatedSession> {
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
    if (await this.educatorRepository.findByLinkedPlayerId(invite.playerId)) {
      throw new PlayerAccountExistsError();
    }

    const account = await this.educatorRepository.create({
      email,
      displayName,
      passwordHash: await hashPassword(password),
      role: "player",
      linkedPlayerId: invite.playerId,
    });
    await this.playerInviteRepository.markConsumed(invite.id);
    return this.authService.openSession(account);
  }
}
