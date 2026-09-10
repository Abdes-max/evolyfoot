import { EducatorNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, PersistedPlayer, PlayerDetailsPatch, PlayerRepository } from "./repositories";

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ValidationError("Indique un prénom.");
  }
  return trimmed;
}

const maxFieldLength = 200;
// Garde-fou de taille pour la photo (data URL) : ~700 Ko de base64 ≈ 500 Ko d'image. Le
// redimensionnement se fait côté client ; ceci n'est qu'un plafond de sécurité côté serveur.
const maxPhotoLength = 700_000;

function normalizeOptional(value: string | null | undefined, limit: number): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > limit) {
    throw new ValidationError("Un champ de la fiche joueur est trop long.");
  }
  return trimmed;
}

export interface PlayerDetailsInput {
  name?: string;
  photo?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
}

export class RosterService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly playerRepository: PlayerRepository,
  ) {}

  async list(educatorId: string): Promise<PersistedPlayer[]> {
    return this.playerRepository.listByEducator(educatorId);
  }

  async add(educatorId: string, name: string): Promise<PersistedPlayer> {
    const trimmed = normalizeName(name);
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    return this.playerRepository.create(educatorId, trimmed);
  }

  async rename(educatorId: string, playerId: string, name: string): Promise<PersistedPlayer> {
    const trimmed = normalizeName(name);
    return this.playerRepository.rename(playerId, educatorId, trimmed);
  }

  async updateDetails(educatorId: string, playerId: string, input: PlayerDetailsInput): Promise<PersistedPlayer> {
    const patch: PlayerDetailsPatch = {};
    if (input.name !== undefined) {
      patch.name = normalizeName(input.name);
    }
    if (input.birthDate !== undefined) {
      const normalized = normalizeOptional(input.birthDate, maxFieldLength);
      if (normalized !== null && normalized !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        throw new ValidationError("La date de naissance doit être au format AAAA-MM-JJ.");
      }
      patch.birthDate = normalized ?? null;
    }
    if (input.email !== undefined) {
      const normalized = normalizeOptional(input.email, maxFieldLength);
      if (normalized !== null && normalized !== undefined && !normalized.includes("@")) {
        throw new ValidationError("L’adresse e-mail est invalide.");
      }
      patch.email = normalized ?? null;
    }
    const phone = normalizeOptional(input.phone, maxFieldLength);
    if (phone !== undefined) {
      patch.phone = phone;
    }
    const photo = normalizeOptional(input.photo, maxPhotoLength);
    if (photo !== undefined) {
      if (photo !== null && !photo.startsWith("data:image/")) {
        throw new ValidationError("La photo doit être une image.");
      }
      patch.photo = photo;
    }
    return this.playerRepository.update(playerId, educatorId, patch);
  }

  async remove(educatorId: string, playerId: string): Promise<void> {
    return this.playerRepository.remove(playerId, educatorId);
  }
}
