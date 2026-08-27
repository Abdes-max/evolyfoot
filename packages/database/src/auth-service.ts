import { normalizeEducatorEmail } from "./email";
import { InvalidCredentialsError, ValidationError } from "./errors";
import { hashPassword, validatePassword, verifyPassword } from "./password";
import { generateSessionToken, hashSessionToken } from "./session-token";
import type { EducatorRecord, EducatorRepository, SessionRepository } from "./repositories";

const DEFAULT_SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 jours

export interface AuthenticatedSession {
  educator: EducatorRecord;
  sessionToken: string;
  expiresAt: Date;
}

export interface AuthServiceOptions {
  sessionDurationMs?: number;
  now?: () => Date;
}

function validateDisplayName(displayName: string): string {
  const trimmed = displayName.trim();

  if (!trimmed) {
    throw new Error("Le nom de l’éducateur est obligatoire.");
  }

  return trimmed;
}

function asValidationError<T>(read: () => T): T {
  try {
    return read();
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : "Champ invalide.");
  }
}

export class AuthService {
  private readonly sessionDurationMs: number;
  private readonly now: () => Date;

  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly sessionRepository: SessionRepository,
    options: AuthServiceOptions = {},
  ) {
    this.sessionDurationMs = options.sessionDurationMs ?? DEFAULT_SESSION_DURATION_MS;
    this.now = options.now ?? (() => new Date());
  }

  async register(input: { email: string; password: string; displayName: string }): Promise<AuthenticatedSession> {
    const email = asValidationError(() => normalizeEducatorEmail(input.email));
    const password = asValidationError(() => validatePassword(input.password));
    const displayName = asValidationError(() => validateDisplayName(input.displayName));
    const passwordHash = await hashPassword(password);
    const educator = await this.educatorRepository.create({ email, displayName, passwordHash });
    return this.createSession(educator);
  }

  async login(input: { email: string; password: string }): Promise<AuthenticatedSession> {
    const email = asValidationError(() => normalizeEducatorEmail(input.email));
    const record = await this.educatorRepository.findByEmail(email);
    if (!record || !(await verifyPassword(input.password, record.passwordHash))) {
      throw new InvalidCredentialsError();
    }
    const educator: EducatorRecord = {
      id: record.id,
      email: record.email,
      displayName: record.displayName,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    return this.createSession(educator);
  }

  async logout(sessionToken: string): Promise<void> {
    await this.sessionRepository.deleteByTokenHash(hashSessionToken(sessionToken));
  }

  async getEducatorForSession(sessionToken: string): Promise<EducatorRecord | null> {
    const session = await this.sessionRepository.findValidByTokenHash(hashSessionToken(sessionToken));
    if (!session) {
      return null;
    }
    return this.educatorRepository.findById(session.educatorId);
  }

  private async createSession(educator: EducatorRecord): Promise<AuthenticatedSession> {
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(this.now().getTime() + this.sessionDurationMs);
    await this.sessionRepository.create({
      educatorId: educator.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt,
    });
    return { educator, sessionToken, expiresAt };
  }
}
