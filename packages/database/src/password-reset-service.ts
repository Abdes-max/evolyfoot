import { normalizeEducatorEmail } from "./email";
import { ValidationError } from "./errors";
import { hashPassword, validatePassword } from "./password";
import { generateSessionToken, hashSessionToken } from "./session-token";
import type { EducatorRepository, PasswordResetRepository } from "./repositories";

const RESET_DURATION_MS = 1000 * 60 * 60; // 1 heure
const MAX_REQUESTS_PER_WINDOW = 3;
const REQUEST_WINDOW_MS = 1000 * 60 * 60;

export class PasswordResetInvalidError extends Error {
  constructor(message = "Ce lien de réinitialisation n’est plus valide.") {
    super(message);
    this.name = "PasswordResetInvalidError";
  }
}

export interface CreatedPasswordReset {
  token: string; // en clair, renvoyé une seule fois -- à insérer dans le lien de l'e-mail
  email: string;
  displayName: string;
}

// Mot de passe oublié : lien à usage unique, valable 1 heure. Seul le hash du jeton est stocké.
export class PasswordResetService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // `null` quand aucun e-mail ne doit partir : adresse inconnue ou invalide, ou trop de demandes
  // récentes. L'appelant répond la même chose dans tous les cas, pour ne pas révéler quelles
  // adresses ont un compte. Un nouveau lien annule les précédents.
  async request(rawEmail: string): Promise<CreatedPasswordReset | null> {
    let email: string;
    try {
      email = normalizeEducatorEmail(rawEmail);
    } catch {
      return null;
    }
    const account = await this.educatorRepository.findByEmail(email);
    if (!account) {
      return null;
    }
    const windowStart = new Date(this.now().getTime() - REQUEST_WINDOW_MS);
    const recent = await this.passwordResetRepository.countCreatedSince(account.id, windowStart);
    if (recent >= MAX_REQUESTS_PER_WINDOW) {
      return null;
    }
    const token = generateSessionToken();
    await this.passwordResetRepository.replaceForEducator({
      educatorId: account.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(this.now().getTime() + RESET_DURATION_MS),
    });
    return { token, email: account.email, displayName: account.displayName };
  }

  // Change le mot de passe et ferme toutes les sessions ouvertes : si le compte était compromis,
  // l'intrus perd aussi son accès.
  async reset(token: string, newPassword: string): Promise<void> {
    let password: string;
    try {
      password = validatePassword(newPassword);
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : "Mot de passe invalide.");
    }
    const reset = await this.passwordResetRepository.findByTokenHash(hashSessionToken(token));
    if (!reset || reset.consumedAt || reset.expiresAt.getTime() <= this.now().getTime()) {
      throw new PasswordResetInvalidError();
    }
    const applied = await this.passwordResetRepository.apply(reset.id, reset.educatorId, await hashPassword(password));
    if (!applied) {
      throw new PasswordResetInvalidError();
    }
  }
}
