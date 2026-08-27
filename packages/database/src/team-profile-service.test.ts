import type { TeamProfile } from "@evolyfoot/domain";
import { describe, expect, it } from "vitest";
import { EducatorNotFoundError, TeamNotFoundError } from "./errors";
import type {
  EducatorRecord,
  EducatorRepository,
  PersistedTeamProfile,
  TeamRepository,
} from "./repositories";
import { TeamProfileService } from "./team-profile-service";

const validProfile: TeamProfile = {
  name: "FC Horizon",
  ageGroup: "U12",
  playerCount: 14,
  sessionsPerWeek: 2,
  trainingDays: ["Mardi", "Jeudi"],
};

class InMemoryEducatorRepository implements EducatorRepository {
  private readonly educators = new Map<string, EducatorRecord>();

  constructor(ids: readonly string[]) {
    for (const id of ids) {
      this.educators.set(id, {
        id,
        email: `${id}@example.test`,
        displayName: id,
        createdAt: new Date("2026-08-18T12:00:00.000Z"),
        updatedAt: new Date("2026-08-18T12:00:00.000Z"),
      });
    }
  }

  async create(input: { email: string; displayName: string; passwordHash: string }): Promise<EducatorRecord> {
    const id = `educator-${this.educators.size + 1}`;
    const educator: EducatorRecord = {
      id,
      email: input.email,
      displayName: input.displayName,
      createdAt: new Date("2026-08-18T12:00:00.000Z"),
      updatedAt: new Date("2026-08-18T12:00:00.000Z"),
    };
    this.educators.set(id, educator);
    return educator;
  }

  async existsById(id: string): Promise<boolean> {
    return this.educators.has(id);
  }

  async findById(id: string): Promise<EducatorRecord | null> {
    return this.educators.get(id) ?? null;
  }

  async findByEmail(): Promise<null> {
    return null;
  }
}

class InMemoryTeamRepository implements TeamRepository {
  readonly teamsByEducatorId = new Map<string, PersistedTeamProfile>();
  readonly readEducatorIds: string[] = [];
  writeCount = 0;

  async upsertForEducator(educatorId: string, profile: TeamProfile): Promise<PersistedTeamProfile> {
    this.writeCount += 1;
    const existing = this.teamsByEducatorId.get(educatorId);
    const saved: PersistedTeamProfile = {
      id: existing?.id ?? `team-${educatorId}`,
      educatorId,
      profile,
      createdAt: existing?.createdAt ?? new Date("2026-08-18T12:00:00.000Z"),
      updatedAt: new Date("2026-08-18T12:00:00.000Z"),
    };
    this.teamsByEducatorId.set(educatorId, saved);
    return saved;
  }

  async findForEducator(educatorId: string): Promise<PersistedTeamProfile | null> {
    this.readEducatorIds.push(educatorId);
    return this.teamsByEducatorId.get(educatorId) ?? null;
  }
}

describe("TeamProfileService", () => {
  it("rejects an incomplete profile before writing a team", async () => {
    const teamRepository = new InMemoryTeamRepository();
    const service = new TeamProfileService(new InMemoryEducatorRepository(["educator-1"]), teamRepository);
    const incompleteProfile = { ...validProfile, playerCount: 5 };

    await expect(service.save("educator-1", incompleteProfile)).rejects.toThrow(
      "Le profil d’équipe est incomplet.",
    );
    expect(teamRepository.writeCount).toBe(0);
  });

  it("rejects saving a valid profile for an educator that does not exist", async () => {
    const service = new TeamProfileService(new InMemoryEducatorRepository([]), new InMemoryTeamRepository());

    await expect(service.save("missing", validProfile)).rejects.toBeInstanceOf(EducatorNotFoundError);
  });

  it("saves a valid profile for its educator", async () => {
    const service = new TeamProfileService(
      new InMemoryEducatorRepository(["educator-1"]),
      new InMemoryTeamRepository(),
    );

    const saved = await service.save("educator-1", validProfile);

    expect(saved.educatorId).toBe("educator-1");
    expect(saved.profile.name).toBe("FC Horizon");
  });

  it("looks up a team using the caller educator ID", async () => {
    const teamRepository = new InMemoryTeamRepository();
    const service = new TeamProfileService(new InMemoryEducatorRepository(["educator-1", "educator-2"]), teamRepository);
    await service.save("educator-1", validProfile);
    await service.save("educator-2", { ...validProfile, name: "AS Rivière" });

    const team = await service.get("educator-2");

    expect(team.profile.name).toBe("AS Rivière");
    expect(teamRepository.readEducatorIds).toEqual(["educator-2"]);
  });

  it("rejects a missing team for the calling educator", async () => {
    const service = new TeamProfileService(
      new InMemoryEducatorRepository(["educator-1"]),
      new InMemoryTeamRepository(),
    );

    await expect(service.get("educator-1")).rejects.toBeInstanceOf(TeamNotFoundError);
  });
});
