import { randomInt } from "node:crypto";
import { ClubNotFoundError, ValidationError } from "./errors";
import type { ClubRecord, ClubRepository, SharedClubExercise } from "./repositories";

// Sans 0/O ni 1/I/L : le code se dicte et se recopie à la main.
const joinCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const clubJoinCodeLength = 8;

export function generateClubJoinCode(): string {
  return Array.from({ length: clubJoinCodeLength }, () => joinCodeAlphabet[randomInt(joinCodeAlphabet.length)]).join("");
}

export function normalizeClubJoinCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

// Partage entre éducateurs d'un même club. Un compte éducateur appartient à un club au plus ; ses
// équipes ajoutées partagent aussi leurs exercices. Le dernier membre qui part supprime le club.
export class ClubService {
  constructor(
    private readonly clubRepository: ClubRepository,
    private readonly generateJoinCode: () => string = generateClubJoinCode,
  ) {}

  async get(accountId: string): Promise<ClubRecord | null> {
    return this.clubRepository.findForMember(accountId);
  }

  async create(accountId: string, name: string): Promise<ClubRecord> {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      throw new ValidationError("Donne au club un nom de 2 à 80 caractères.");
    }
    await this.requireNoClub(accountId);
    let joinCode = this.generateJoinCode();
    for (let attempt = 0; (await this.clubRepository.findIdByJoinCode(joinCode)) !== null; attempt += 1) {
      if (attempt >= 5) {
        throw new Error("Impossible de générer un code de club libre.");
      }
      joinCode = this.generateJoinCode();
    }
    return this.clubRepository.create(accountId, trimmed, joinCode);
  }

  async join(accountId: string, code: string): Promise<ClubRecord> {
    await this.requireNoClub(accountId);
    const clubId = await this.clubRepository.findIdByJoinCode(normalizeClubJoinCode(code));
    if (!clubId) {
      throw new ClubNotFoundError();
    }
    await this.clubRepository.setMembership(accountId, clubId);
    return (await this.clubRepository.findForMember(accountId)) as ClubRecord;
  }

  async leave(accountId: string): Promise<void> {
    const club = await this.clubRepository.findForMember(accountId);
    if (!club) {
      return;
    }
    await this.clubRepository.setMembership(accountId, null);
    await this.clubRepository.deleteIfEmpty(club.id);
  }

  async sharedExercises(accountId: string): Promise<SharedClubExercise[]> {
    const club = await this.clubRepository.findForMember(accountId);
    return club ? this.clubRepository.listSharedExercises(club.id, accountId) : [];
  }

  private async requireNoClub(accountId: string): Promise<void> {
    if (await this.clubRepository.findForMember(accountId)) {
      throw new ValidationError("Quitte d’abord ton club actuel.");
    }
  }
}
