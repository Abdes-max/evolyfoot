import { describe, expect, it } from "vitest";
import { RosterService } from "./roster-service";
import { EducatorNotFoundError, PlayerNotFoundError, ValidationError } from "./errors";
import type { EducatorRecord, EducatorRepository, PersistedPlayer, PlayerRepository } from "./repositories";

class InMemoryEducatorRepository implements EducatorRepository {
  constructor(private readonly ids: readonly string[]) {}

  async create(): Promise<EducatorRecord> {
    throw new Error("not used");
  }

  async existsById(id: string): Promise<boolean> {
    return this.ids.includes(id);
  }

  async findById(): Promise<EducatorRecord | null> {
    return null;
  }

  async findByEmail(): Promise<null> {
    return null;
  }
}

class InMemoryPlayerRepository implements PlayerRepository {
  private readonly players = new Map<string, PersistedPlayer>();
  private sequence = 0;

  async listByEducator(educatorId: string): Promise<PersistedPlayer[]> {
    return [...this.players.values()].filter((player) => player.educatorId === educatorId);
  }

  async create(educatorId: string, name: string): Promise<PersistedPlayer> {
    this.sequence += 1;
    const player: PersistedPlayer = {
      id: `player-${this.sequence}`,
      educatorId,
      name,
      createdAt: new Date("2026-08-29T12:00:00.000Z"),
      updatedAt: new Date("2026-08-29T12:00:00.000Z"),
    };
    this.players.set(player.id, player);
    return player;
  }

  async rename(id: string, educatorId: string, name: string): Promise<PersistedPlayer> {
    const existing = this.players.get(id);
    if (!existing || existing.educatorId !== educatorId) {
      throw new PlayerNotFoundError();
    }
    const updated: PersistedPlayer = { ...existing, name, updatedAt: new Date("2026-08-29T13:00:00.000Z") };
    this.players.set(id, updated);
    return updated;
  }

  async remove(id: string, educatorId: string): Promise<void> {
    const existing = this.players.get(id);
    if (!existing || existing.educatorId !== educatorId) {
      throw new PlayerNotFoundError();
    }
    this.players.delete(id);
  }
}

describe("RosterService", () => {
  it("rejects an empty name before writing anything", async () => {
    const playerRepository = new InMemoryPlayerRepository();
    const service = new RosterService(new InMemoryEducatorRepository(["educator-1"]), playerRepository);

    await expect(service.add("educator-1", "   ")).rejects.toBeInstanceOf(ValidationError);
    expect(await playerRepository.listByEducator("educator-1")).toHaveLength(0);
  });

  it("rejects adding a player for an educator that does not exist", async () => {
    const service = new RosterService(new InMemoryEducatorRepository([]), new InMemoryPlayerRepository());

    await expect(service.add("missing", "Kylian")).rejects.toBeInstanceOf(EducatorNotFoundError);
  });

  it("adds a player, trimming its name", async () => {
    const playerRepository = new InMemoryPlayerRepository();
    const service = new RosterService(new InMemoryEducatorRepository(["educator-1"]), playerRepository);

    const player = await service.add("educator-1", "  Kylian  ");

    expect(player.name).toBe("Kylian");
    expect(player.educatorId).toBe("educator-1");
  });

  it("lists only the players belonging to the requested educator", async () => {
    const playerRepository = new InMemoryPlayerRepository();
    const service = new RosterService(new InMemoryEducatorRepository(["educator-1", "educator-2"]), playerRepository);
    await service.add("educator-1", "Kylian");
    await service.add("educator-2", "Ousmane");

    const roster = await service.list("educator-1");

    expect(roster).toHaveLength(1);
    expect(roster[0]?.name).toBe("Kylian");
  });

  it("rejects renaming a player belonging to another educator", async () => {
    const playerRepository = new InMemoryPlayerRepository();
    const service = new RosterService(new InMemoryEducatorRepository(["educator-1", "educator-2"]), playerRepository);
    const player = await service.add("educator-1", "Kylian");

    await expect(service.rename("educator-2", player.id, "Ousmane")).rejects.toBeInstanceOf(PlayerNotFoundError);
  });

  it("renames a player belonging to the requesting educator", async () => {
    const playerRepository = new InMemoryPlayerRepository();
    const service = new RosterService(new InMemoryEducatorRepository(["educator-1"]), playerRepository);
    const player = await service.add("educator-1", "Kylian");

    const renamed = await service.rename("educator-1", player.id, "Ousmane");

    expect(renamed.name).toBe("Ousmane");
  });

  it("rejects removing a player belonging to another educator", async () => {
    const playerRepository = new InMemoryPlayerRepository();
    const service = new RosterService(new InMemoryEducatorRepository(["educator-1", "educator-2"]), playerRepository);
    const player = await service.add("educator-1", "Kylian");

    await expect(service.remove("educator-2", player.id)).rejects.toBeInstanceOf(PlayerNotFoundError);
    expect(await playerRepository.listByEducator("educator-1")).toHaveLength(1);
  });

  it("removes a player belonging to the requesting educator", async () => {
    const playerRepository = new InMemoryPlayerRepository();
    const service = new RosterService(new InMemoryEducatorRepository(["educator-1"]), playerRepository);
    const player = await service.add("educator-1", "Kylian");

    await service.remove("educator-1", player.id);

    expect(await playerRepository.listByEducator("educator-1")).toHaveLength(0);
  });
});
