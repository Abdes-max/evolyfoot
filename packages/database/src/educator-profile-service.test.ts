import { describe, expect, it } from "vitest";
import { EducatorProfileService } from "./educator-profile-service";
import { EducatorNotFoundError, InvalidCredentialsError, ValidationError } from "./errors";
import { hashPassword } from "./password";
import type { EducatorAuthRecord, EducatorProfile, EducatorProfilePatch, EducatorProfileRepository } from "./repositories";

class InMemoryEducatorProfileRepository implements EducatorProfileRepository {
  passwordHash = "";
  profile: EducatorProfile;

  constructor(id: string) {
    this.profile = {
      id,
      email: "coach@example.test",
      displayName: "Coach",
      birthDate: null,
      club: null,
      country: null,
      address: null,
      phone: null,
      diploma: null,
      seasonFormat: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
  }

  async existsById(id: string): Promise<boolean> {
    return id === this.profile.id;
  }

  async findProfileById(id: string): Promise<EducatorProfile | null> {
    return id === this.profile.id ? this.profile : null;
  }

  async findAuthById(id: string): Promise<EducatorAuthRecord | null> {
    if (id !== this.profile.id) {
      return null;
    }
    return { ...this.profile, updatedAt: this.profile.createdAt, passwordHash: this.passwordHash };
  }

  async updateProfile(id: string, patch: EducatorProfilePatch): Promise<EducatorProfile> {
    if (id !== this.profile.id) {
      throw new EducatorNotFoundError();
    }
    this.profile = { ...this.profile, ...patch };
    return this.profile;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    if (id === this.profile.id) {
      this.passwordHash = passwordHash;
    }
  }
}

describe("EducatorProfileService", () => {
  it("returns the profile of an existing educator", async () => {
    const repository = new InMemoryEducatorProfileRepository("educator-1");
    const service = new EducatorProfileService(repository);

    await expect(service.get("educator-1")).resolves.toMatchObject({ email: "coach@example.test" });
    await expect(service.get("missing")).rejects.toBeInstanceOf(EducatorNotFoundError);
  });

  it("trims fields, clears them on empty string, leaves absent keys untouched", async () => {
    const repository = new InMemoryEducatorProfileRepository("educator-1");
    const service = new EducatorProfileService(repository);

    const updated = await service.update("educator-1", { club: "  FC Horizon  ", phone: "" , country: "France" });

    expect(updated.club).toBe("FC Horizon");
    expect(updated.phone).toBeNull();
    expect(updated.country).toBe("France");
    expect(updated.displayName).toBe("Coach");
  });

  it("rejects an empty display name and a malformed birth date", async () => {
    const repository = new InMemoryEducatorProfileRepository("educator-1");
    const service = new EducatorProfileService(repository);

    await expect(service.update("educator-1", { displayName: "   " })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.update("educator-1", { birthDate: "11/05/1986" })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.update("educator-1", { birthDate: "1986-05-11" })).resolves.toMatchObject({
      birthDate: "1986-05-11",
    });
  });

  it("changes the password only when the current one matches and the new one is valid", async () => {
    const repository = new InMemoryEducatorProfileRepository("educator-1");
    repository.passwordHash = await hashPassword("current-password");
    const service = new EducatorProfileService(repository);

    await expect(service.changePassword("educator-1", "wrong-password", "another-strong-one")).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    await expect(service.changePassword("educator-1", "current-password", "short")).rejects.toBeInstanceOf(ValidationError);

    await service.changePassword("educator-1", "current-password", "a-brand-new-password");
    expect(repository.passwordHash).not.toBe("");
    await expect(service.changePassword("educator-1", "a-brand-new-password", "yet-another-one")).resolves.toBeUndefined();
  });
});
