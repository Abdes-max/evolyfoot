import { EducatorNotFoundError, InvalidCredentialsError } from "./errors";
import { verifyPassword } from "./password";
import type { AccountRepository } from "./repositories";

// Droits RGPD du titulaire d'un compte : récupérer ses données et les effacer. La suppression d'un
// compte éducateur emporte son équipe, ses joueurs et les comptes tuteur qui les suivent.
export class AccountService {
  constructor(private readonly accountRepository: AccountRepository) {}

  async exportData(accountId: string): Promise<Record<string, unknown>> {
    const data = await this.accountRepository.exportData(accountId);
    if (!data) {
      throw new EducatorNotFoundError();
    }
    return data;
  }

  async deleteAccount(accountId: string, password: string): Promise<void> {
    const passwordHash = await this.accountRepository.findPasswordHash(accountId);
    if (!passwordHash) {
      throw new EducatorNotFoundError();
    }
    if (!(await verifyPassword(password, passwordHash))) {
      throw new InvalidCredentialsError();
    }
    await this.accountRepository.delete(accountId);
  }
}
