import { describe, expect, it } from "vitest";
import { AuthService } from "./auth-service";
import { InvalidCredentialsError, ValidationError } from "./errors";
import { hashSessionToken } from "./session-token";
import type {
  EducatorAuthRecord,
  EducatorRecord,
  EducatorRepository,
  SessionRecord,
  SessionRepository,
} from "./repositories";

const FIXED_DATE = new Date("2026-08-27T12:00:00.000Z");

class InMemoryEducatorRepository implements EducatorRepository {
  private readonly byId = new Map<string, EducatorAuthRecord>();
  private nextId = 1;

  async create(input: { email: string; displayName: string; passwordHash: string }): Promise<EducatorRecord> {
    if ([...this.byId.values()].some((educator) => educator.email === input.email)) {
      throw new Error("Cette adresse e-mail est déjà utilisée.");
    }

    const educator: EducatorAuthRecord = {
      id: `educator-${this.nextId++}`,
      email: input.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    };
    this.byId.set(educator.id, educator);
    return educator;
  }

  async existsById(id: string): Promise<boolean> {
    return this.byId.has(id);
  }

  async findById(id: string): Promise<EducatorRecord | null> {
    return this.byId.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<EducatorAuthRecord | null> {
    return [...this.byId.values()].find((educator) => educator.email === email) ?? null;
  }
}

class InMemorySessionRepository implements SessionRepository {
  private readonly byTokenHash = new Map<string, SessionRecord>();
  private nextId = 1;
  deleteCount = 0;

  async create(input: { educatorId: string; tokenHash: string; expiresAt: Date }): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: `session-${this.nextId++}`,
      educatorId: input.educatorId,
      expiresAt: input.expiresAt,
      createdAt: FIXED_DATE,
    };
    this.byTokenHash.set(input.tokenHash, session);
    return session;
  }

  async findValidByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const session = this.byTokenHash.get(tokenHash);
    if (!session || session.expiresAt.getTime() <= FIXED_DATE.getTime()) {
      return null;
    }
    return session;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    this.deleteCount += 1;
    this.byTokenHash.delete(tokenHash);
  }
}

function createService(options: { now?: () => Date; sessionDurationMs?: number } = {}) {
  const educatorRepository = new InMemoryEducatorRepository();
  const sessionRepository = new InMemorySessionRepository();
  const service = new AuthService(educatorRepository, sessionRepository, {
    now: options.now ?? (() => FIXED_DATE),
    sessionDurationMs: options.sessionDurationMs,
  });
  return { service, educatorRepository, sessionRepository };
}

describe("AuthService.register", () => {
  it("creates an educator with a hashed password and opens a session", async () => {
    const { service, educatorRepository } = createService();

    const result = await service.register({
      email: "coach@example.test",
      password: "motdepasse1",
      displayName: "  Coach Test  ",
    });

    expect(result.educator.email).toBe("coach@example.test");
    expect(result.educator.displayName).toBe("Coach Test");
    expect(result.sessionToken).toHaveLength(43);
    expect(result.expiresAt.getTime()).toBeGreaterThan(FIXED_DATE.getTime());

    const stored = await educatorRepository.findByEmail("coach@example.test");
    expect(stored?.passwordHash).not.toBe("motdepasse1");
  });

  it("rejects a password shorter than 10 characters before creating anything", async () => {
    const { service, educatorRepository } = createService();

    await expect(
      service.register({ email: "coach@example.test", password: "short", displayName: "Coach" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(educatorRepository.findByEmail("coach@example.test")).resolves.toBeNull();
  });

  it("rejects a blank display name", async () => {
    const { service } = createService();

    await expect(
      service.register({ email: "coach@example.test", password: "motdepasse1", displayName: "   " }),
    ).rejects.toThrow("Le nom de l’éducateur est obligatoire.");
  });

  it("rejects a blank email as a validation error, distinct from wrong credentials", async () => {
    const { service } = createService();

    await expect(
      service.register({ email: "   ", password: "motdepasse1", displayName: "Coach" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("AuthService.login", () => {
  it("opens a new session for the correct password", async () => {
    const { service } = createService();
    await service.register({ email: "coach@example.test", password: "motdepasse1", displayName: "Coach" });

    const result = await service.login({ email: "coach@example.test", password: "motdepasse1" });

    expect(result.educator.email).toBe("coach@example.test");
    expect(result.sessionToken).toBeTruthy();
  });

  it("rejects an unknown email without revealing it does not exist", async () => {
    const { service } = createService();

    await expect(
      service.login({ email: "inconnu@example.test", password: "motdepasse1" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("rejects the wrong password with the same error as an unknown email", async () => {
    const { service } = createService();
    await service.register({ email: "coach@example.test", password: "motdepasse1", displayName: "Coach" });

    await expect(
      service.login({ email: "coach@example.test", password: "mauvaispasse" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("rejects a blank email as a validation error rather than invalid credentials", async () => {
    const { service } = createService();

    await expect(service.login({ email: "   ", password: "motdepasse1" })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("AuthService.getEducatorForSession", () => {
  it("resolves the educator for a valid session token", async () => {
    const { service } = createService();
    const { educator, sessionToken } = await service.register({
      email: "coach@example.test",
      password: "motdepasse1",
      displayName: "Coach",
    });

    await expect(service.getEducatorForSession(sessionToken)).resolves.toMatchObject({ id: educator.id });
  });

  it("returns null for an unknown token", async () => {
    const { service } = createService();

    await expect(service.getEducatorForSession("jeton-inconnu")).resolves.toBeNull();
  });

  it("returns null for an expired session", async () => {
    const { service } = createService({ sessionDurationMs: -1000 });
    const { sessionToken } = await service.register({
      email: "coach@example.test",
      password: "motdepasse1",
      displayName: "Coach",
    });

    await expect(service.getEducatorForSession(sessionToken)).resolves.toBeNull();
  });
});

describe("AuthService.logout", () => {
  it("invalidates the session token", async () => {
    const { service, sessionRepository } = createService();
    const { sessionToken } = await service.register({
      email: "coach@example.test",
      password: "motdepasse1",
      displayName: "Coach",
    });

    await service.logout(sessionToken);

    expect(sessionRepository.deleteCount).toBe(1);
    await expect(service.getEducatorForSession(sessionToken)).resolves.toBeNull();
  });

  it("is idempotent for an already logged out or unknown token", async () => {
    const { service } = createService();

    await expect(service.logout("jeton-inconnu")).resolves.toBeUndefined();
  });
});

describe("hashSessionToken usage", () => {
  it("never stores the raw session token", async () => {
    const { service, sessionRepository } = createService();
    const { sessionToken } = await service.register({
      email: "coach@example.test",
      password: "motdepasse1",
      displayName: "Coach",
    });

    await expect(sessionRepository.findValidByTokenHash(sessionToken)).resolves.toBeNull();
    await expect(sessionRepository.findValidByTokenHash(hashSessionToken(sessionToken))).resolves.not.toBeNull();
  });
});
