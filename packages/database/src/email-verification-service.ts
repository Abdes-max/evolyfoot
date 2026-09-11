import { generateSessionToken, hashSessionToken } from "./session-token";
import type { EducatorRecord, EducatorRepository, EmailVerificationRepository } from "./repositories";

const VERIFICATION_DURATION_MS = 1000 * 60 * 60 * 48; // 48 heures

export class VerificationInvalidError extends Error {
  constructor(message = "Ce lien de confirmation n’est plus valide.") {
    super(message);
    this.name = "VerificationInvalidError";
  }
}

export interface CreatedVerification {
  token: string; // en clair, renvoyé une seule fois -- à insérer dans le lien de l'e-mail
  expiresAt: Date;
}

// Confirmation de l'adresse e-mail à l'inscription : un lien à usage unique, valable 48h, envoyé
// par e-mail (voir apps/web/src/server/mailer.ts, qui appelle ce service). Ne bloque jamais la
// connexion -- l'éducateur peut utiliser son compte avant de cliquer, l'appli affiche juste un
// rappel tant que `emailVerifiedAt` est vide.
export class EmailVerificationService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly emailVerificationRepository: EmailVerificationRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(educatorId: string): Promise<CreatedVerification> {
    const token = generateSessionToken();
    const expiresAt = new Date(this.now().getTime() + VERIFICATION_DURATION_MS);
    await this.emailVerificationRepository.create({
      educatorId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    });
    return { token, expiresAt };
  }

  // Marque le compte confirmé et renvoie l'éducateur à jour. Idempotent : si le compte est déjà
  // confirmé (lien cliqué deux fois, ou depuis deux onglets), ne renvoie pas d'erreur.
  async consume(token: string): Promise<EducatorRecord> {
    const verification = await this.emailVerificationRepository.findByTokenHash(hashSessionToken(token));
    if (!verification || verification.expiresAt.getTime() <= this.now().getTime()) {
      throw new VerificationInvalidError();
    }
    const educator = await this.educatorRepository.findById(verification.educatorId);
    if (!educator) {
      throw new VerificationInvalidError();
    }
    if (!verification.consumedAt) {
      await this.emailVerificationRepository.markConsumed(verification.id);
    }
    if (!educator.emailVerifiedAt) {
      await this.educatorRepository.markEmailVerified(educator.id);
    }
    return { ...educator, emailVerifiedAt: educator.emailVerifiedAt ?? this.now() };
  }
}
