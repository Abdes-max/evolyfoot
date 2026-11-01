import type { AuthenticatedSession, AuthService } from "./auth-service";
import { DuplicateEducatorEmailError, EducatorNotFoundError, ValidationError } from "./errors";
import { normalizeEducatorEmail } from "./email";
import { hashPassword, validatePassword } from "./password";
import { InviteInvalidError } from "./player-invite-service";
import { generateSessionToken, hashSessionToken } from "./session-token";
import type { EducatorRepository, StaffMember, StaffRepository, TeamRepository } from "./repositories";

const INVITE_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 jours : ce lien donne accès à toute l'équipe
export const maxStaffMembers = 5;

// Adjoints d'un éducateur : ils travaillent sur son équipe, ses joueurs et ses évaluations, avec
// leur propre compte. Seul l'éducateur peut les inviter ou les retirer.
export class StaffService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly staffRepository: StaffRepository,
    private readonly teamRepository: TeamRepository,
    private readonly authService: Pick<AuthService, "openSession">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(ownerId: string): Promise<StaffMember[]> {
    return this.staffRepository.listMembers(ownerId);
  }

  async invite(ownerId: string): Promise<{ token: string; expiresAt: Date }> {
    if ((await this.staffRepository.listMembers(ownerId)).length >= maxStaffMembers) {
      throw new ValidationError(`Ton staff compte déjà ${maxStaffMembers} adjoints.`);
    }
    const token = generateSessionToken();
    const expiresAt = new Date(this.now().getTime() + INVITE_DURATION_MS);
    await this.staffRepository.createInvite({ educatorId: ownerId, tokenHash: hashSessionToken(token), expiresAt });
    return { token, expiresAt };
  }

  private async activeInvite(token: string) {
    const invite = await this.staffRepository.findInviteByTokenHash(hashSessionToken(token));
    if (!invite || invite.consumedAt || invite.expiresAt.getTime() <= this.now().getTime()) {
      throw new InviteInvalidError();
    }
    return invite;
  }

  async preview(token: string): Promise<{ coachName: string; teamName: string | null }> {
    const invite = await this.activeInvite(token);
    const [owner, team] = await Promise.all([this.educatorRepository.findById(invite.educatorId), this.teamRepository.findForEducator(invite.educatorId)]);
    if (!owner) {
      throw new InviteInvalidError();
    }
    return { coachName: owner.displayName, teamName: team?.profile.name ?? null };
  }

  async join(token: string, input: { email: string; password: string; displayName: string }): Promise<AuthenticatedSession> {
    const invite = await this.activeInvite(token);
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
    if (await this.educatorRepository.findByEmail(email)) {
      throw new DuplicateEducatorEmailError();
    }
    const passwordHash = await hashPassword(password);
    // Réservé avant la création du compte : deux envois simultanés d'un même lien n'ouvrent pas
    // deux accès à l'équipe.
    if (!(await this.staffRepository.consumeInvite(invite.id))) {
      throw new InviteInvalidError();
    }
    const account = await this.educatorRepository.create({ email, displayName, passwordHash, role: "assistant", ownerEducatorId: invite.educatorId });
    return this.authService.openSession(account);
  }

  async remove(ownerId: string, memberId: string): Promise<void> {
    if (!(await this.staffRepository.removeMember(ownerId, memberId))) {
      throw new EducatorNotFoundError();
    }
  }
}
