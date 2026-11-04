import { describe, expect, it } from "vitest";
import { AuthService } from "./auth-service";
import { TeamSpaceNotFoundError, ValidationError } from "./errors";
import type {
  AccountRole,
  EducatorAuthRecord,
  EducatorRecord,
  EducatorRepository,
  PersistedTeamProfile,
  SessionRecord,
  SessionRepository,
  TeamRepository,
  TeamSpaceRepository,
} from "./repositories";
import { hashSessionToken } from "./session-token";
import { maxTeamsPerEducator, TeamSpaceService } from "./team-space-service";

const NOW = new Date("2026-11-04T09:00:00.000Z");

class InMemoryEducators implements EducatorRepository, TeamSpaceRepository {
  readonly byId = new Map<string, EducatorAuthRecord>();
  private nextId = 1;

  async create(input: { email: string; displayName: string; passwordHash: string; role?: AccountRole; ownerEducatorId?: string }): Promise<EducatorRecord> {
    const educator: EducatorAuthRecord = { id: `educator-${this.nextId++}`, ...input, createdAt: NOW, updatedAt: NOW };
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

  async findByLinkedPlayerId(): Promise<null> {
    return null;
  }

  async markEmailVerified(): Promise<void> {}

  async listForOwner(ownerId: string): Promise<EducatorRecord[]> {
    return [...this.byId.values()].filter((educator) => educator.role === "team" && educator.ownerEducatorId === ownerId);
  }

  async remove(ownerId: string, teamSpaceId: string): Promise<boolean> {
    const space = this.byId.get(teamSpaceId);
    if (space?.role !== "team" || space.ownerEducatorId !== ownerId) {
      return false;
    }
    return this.byId.delete(teamSpaceId);
  }
}

class InMemorySessions implements SessionRepository {
  readonly byTokenHash = new Map<string, SessionRecord>();

  async create(input: { educatorId: string; tokenHash: string; expiresAt: Date }): Promise<SessionRecord> {
    const session: SessionRecord = { id: input.tokenHash, educatorId: input.educatorId, expiresAt: input.expiresAt, createdAt: NOW };
    this.byTokenHash.set(input.tokenHash, session);
    return session;
  }

  async findValidByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.byTokenHash.get(tokenHash) ?? null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    this.byTokenHash.delete(tokenHash);
  }

  async deleteOthers(): Promise<void> {}

  async setActiveTeam(tokenHash: string, activeTeamId: string | null): Promise<void> {
    const session = this.byTokenHash.get(tokenHash);
    if (session) {
      this.byTokenHash.set(tokenHash, { ...session, activeTeamId });
    }
  }
}

class InMemoryTeams implements TeamRepository {
  readonly names = new Map<string, string>();

  async upsertForEducator(): Promise<PersistedTeamProfile> {
    throw new Error("non utilisé");
  }

  async findForEducator(educatorId: string): Promise<PersistedTeamProfile | null> {
    const name = this.names.get(educatorId);
    return name
      ? ({ id: `team-${educatorId}`, educatorId, profile: { name, ageGroup: "U11" }, createdAt: NOW, updatedAt: NOW } as unknown as PersistedTeamProfile)
      : null;
  }
}

async function setup() {
  const educators = new InMemoryEducators();
  const sessions = new InMemorySessions();
  const teams = new InMemoryTeams();
  const auth = new AuthService(educators, sessions, { now: () => NOW });
  const service = new TeamSpaceService(educators, educators, teams, sessions);
  const { educator: coach, sessionToken } = await auth.register({ email: "coach@example.test", password: "mot-de-passe-solide", displayName: "Coach" });
  teams.names.set(coach.id, "U11 A");
  return { educators, sessions, teams, auth, service, coach, sessionToken };
}

describe("plusieurs équipes par éducateur", () => {
  it("crée une équipe, la rend active et y fait travailler l'éducateur", async () => {
    const { auth, service, coach, sessionToken, teams } = await setup();

    const { id } = await service.create(coach, sessionToken);
    teams.names.set(id, "U13");

    expect((await auth.getEducatorForSession(sessionToken))?.id).toBe(id);
    expect(await service.list(coach, sessionToken)).toEqual([
      { id: coach.id, name: "U11 A", ageGroup: "U11", primary: true, active: false },
      { id, name: "U13", ageGroup: "U11", primary: false, active: true },
    ]);
    // Le compte connecté reste celui de l'éducateur (profil, mot de passe).
    expect((await auth.getAccountForSession(sessionToken))?.id).toBe(coach.id);
  });

  it("revient sur la première équipe, et refuse une équipe qui n'est pas la sienne", async () => {
    const { auth, service, coach, sessionToken } = await setup();
    const { id } = await service.create(coach, sessionToken);
    const other = await auth.register({ email: "autre@example.test", password: "mot-de-passe-solide", displayName: "Autre" });
    const { id: foreign } = await service.create(other.educator, other.sessionToken);

    await service.activate(coach, sessionToken, coach.id);
    expect((await auth.getEducatorForSession(sessionToken))?.id).toBe(coach.id);

    await expect(service.activate(coach, sessionToken, foreign)).rejects.toBeInstanceOf(TeamSpaceNotFoundError);
    await service.activate(coach, sessionToken, id);
    expect((await auth.getEducatorForSession(sessionToken))?.id).toBe(id);
  });

  it("ignore une équipe active qui n'appartient pas à l'éducateur de la session", async () => {
    const { auth, service, sessions, coach, sessionToken } = await setup();
    const other = await auth.register({ email: "autre@example.test", password: "mot-de-passe-solide", displayName: "Autre" });
    const { id: foreign } = await service.create(other.educator, other.sessionToken);

    await sessions.setActiveTeam(hashSessionToken(sessionToken), foreign);

    expect((await auth.getEducatorForSession(sessionToken))?.id).toBe(coach.id);
  });

  it("supprime une équipe supplémentaire et revient sur la première, jamais la première elle-même", async () => {
    const { auth, service, coach, sessionToken } = await setup();
    const { id } = await service.create(coach, sessionToken);

    await expect(service.remove(coach, sessionToken, coach.id)).rejects.toBeInstanceOf(ValidationError);
    await service.remove(coach, sessionToken, id);

    expect((await auth.getEducatorForSession(sessionToken))?.id).toBe(coach.id);
    expect((await service.list(coach, sessionToken)).map((team) => team.id)).toEqual([coach.id]);
  });

  it("limite le nombre d'équipes", async () => {
    const { service, coach, sessionToken } = await setup();
    for (let index = 1; index < maxTeamsPerEducator; index += 1) {
      await service.create(coach, sessionToken);
    }

    await expect(service.create(coach, sessionToken)).rejects.toBeInstanceOf(ValidationError);
  });

  it("n'ouvre jamais de session sur un espace d'équipe, et un adjoint ne crée pas d'équipe", async () => {
    const { auth, service, educators, coach, sessionToken } = await setup();
    const { id } = await service.create(coach, sessionToken);
    const space = educators.byId.get(id)!;

    expect(space.email).toMatch(/@equipes\.evolyfoot\.invalid$/);
    expect(space.displayName).toBe("Coach");
    await expect(auth.login({ email: space.email, password: "mot-de-passe-solide" })).rejects.toThrow();

    const assistant = await educators.create({
      email: "adjoint@example.test",
      displayName: "Adjoint",
      passwordHash: "x",
      role: "assistant",
      ownerEducatorId: coach.id,
    });
    await expect(service.create(assistant, sessionToken)).rejects.toBeInstanceOf(ValidationError);
  });
});
