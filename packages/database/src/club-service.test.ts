import { describe, expect, it } from "vitest";
import { ClubService, generateClubJoinCode, normalizeClubJoinCode } from "./club-service";
import { ClubNotFoundError, ValidationError } from "./errors";
import type { ClubRecord, ClubRepository, SharedClubExercise } from "./repositories";

class InMemoryClubRepository implements ClubRepository {
  clubs = new Map<string, { name: string; joinCode: string }>();
  membership = new Map<string, string>();

  async findForMember(accountId: string): Promise<ClubRecord | null> {
    const clubId = this.membership.get(accountId);
    const club = clubId ? this.clubs.get(clubId) : undefined;
    if (!clubId || !club) {
      return null;
    }
    const members = [...this.membership].filter(([, id]) => id === clubId).map(([id]) => ({ id, displayName: id }));
    return { id: clubId, ...club, members };
  }

  async findIdByJoinCode(joinCode: string): Promise<string | null> {
    return [...this.clubs].find(([, club]) => club.joinCode === joinCode)?.[0] ?? null;
  }

  async create(accountId: string, name: string, joinCode: string): Promise<ClubRecord> {
    const id = `club-${this.clubs.size + 1}`;
    this.clubs.set(id, { name, joinCode });
    this.membership.set(accountId, id);
    return (await this.findForMember(accountId)) as ClubRecord;
  }

  async setMembership(accountId: string, clubId: string | null): Promise<void> {
    if (clubId) {
      this.membership.set(accountId, clubId);
    } else {
      this.membership.delete(accountId);
    }
  }

  async deleteIfEmpty(clubId: string): Promise<void> {
    if (![...this.membership.values()].includes(clubId)) {
      this.clubs.delete(clubId);
    }
  }

  async listSharedExercises(): Promise<SharedClubExercise[]> {
    return [];
  }
}

describe("ClubService", () => {
  it("crée un club et le fait rejoindre avec son code, même tapé en minuscules", async () => {
    const repository = new InMemoryClubRepository();
    const service = new ClubService(repository, () => "ABCD2345");

    const club = await service.create("coach-a", "  US Exemple  ");
    expect(club).toMatchObject({ name: "US Exemple", joinCode: "ABCD2345" });

    const joined = await service.join("coach-b", "abcd-2345");
    expect(joined.members.map((member) => member.id)).toEqual(["coach-a", "coach-b"]);
  });

  it("refuse un code inconnu, un nom vide et un second club", async () => {
    const service = new ClubService(new InMemoryClubRepository(), () => "ABCD2345");
    await expect(service.join("coach-a", "ZZZZ9999")).rejects.toBeInstanceOf(ClubNotFoundError);
    await expect(service.create("coach-a", " ")).rejects.toBeInstanceOf(ValidationError);
    await service.create("coach-a", "US Exemple");
    await expect(service.create("coach-a", "Autre club")).rejects.toBeInstanceOf(ValidationError);
  });

  it("supprime le club quand le dernier membre part", async () => {
    const repository = new InMemoryClubRepository();
    const service = new ClubService(repository, () => "ABCD2345");
    await service.create("coach-a", "US Exemple");
    await service.join("coach-b", "ABCD2345");

    await service.leave("coach-a");
    expect(repository.clubs.size).toBe(1);
    await service.leave("coach-b");
    expect(repository.clubs.size).toBe(0);
  });

  it("génère un autre code quand le premier est déjà pris", async () => {
    const codes = ["ABCD2345", "ABCD2345", "WXYZ6789"];
    const service = new ClubService(new InMemoryClubRepository(), () => codes.shift() as string);
    await service.create("coach-a", "Premier club");
    expect((await service.create("coach-b", "Second club")).joinCode).toBe("WXYZ6789");
  });

  it("génère des codes lisibles", () => {
    expect(generateClubJoinCode()).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(normalizeClubJoinCode(" abcd 2345 ")).toBe("ABCD2345");
  });
});
