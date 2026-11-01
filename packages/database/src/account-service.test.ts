import { describe, expect, it } from "vitest";
import { AccountService } from "./account-service";
import { EducatorNotFoundError, InvalidCredentialsError } from "./errors";
import { hashPassword } from "./password";
import type { AccountRepository } from "./repositories";

class InMemoryAccountRepository implements AccountRepository {
  deleted: string[] = [];

  constructor(private readonly passwordHash: string | null) {}

  async exportData(id: string) {
    return this.passwordHash ? { id, displayName: "Coach" } : null;
  }

  async findPasswordHash() {
    return this.passwordHash;
  }

  async delete(id: string) {
    this.deleted.push(id);
  }
}

describe("AccountService", () => {
  it("exporte les données du compte", async () => {
    const service = new AccountService(new InMemoryAccountRepository("hash"));

    await expect(service.exportData("compte-1")).resolves.toEqual({ id: "compte-1", displayName: "Coach" });
  });

  it("refuse l'export d'un compte inconnu", async () => {
    const service = new AccountService(new InMemoryAccountRepository(null));

    await expect(service.exportData("compte-1")).rejects.toBeInstanceOf(EducatorNotFoundError);
  });

  it("supprime le compte quand le mot de passe est bon", async () => {
    const repository = new InMemoryAccountRepository(await hashPassword("bon-mot-de-passe"));

    await new AccountService(repository).deleteAccount("compte-1", "bon-mot-de-passe");

    expect(repository.deleted).toEqual(["compte-1"]);
  });

  it("ne supprime rien avec un mauvais mot de passe", async () => {
    const repository = new InMemoryAccountRepository(await hashPassword("bon-mot-de-passe"));

    await expect(new AccountService(repository).deleteAccount("compte-1", "mauvais")).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(repository.deleted).toEqual([]);
  });
});
