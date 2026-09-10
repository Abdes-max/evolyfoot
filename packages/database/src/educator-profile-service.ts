import { EducatorNotFoundError, InvalidCredentialsError, ValidationError } from "./errors";
import { hashPassword, validatePassword, verifyPassword } from "./password";
import type { EducatorProfile, EducatorProfilePatch, EducatorProfileRepository } from "./repositories";

// Formats de saison proposés sur la fiche profil. Le libellé stocké est repris tel quel à
// l'affichage (pas d'énumération côté domaine : purement déclaratif).
export const seasonFormats = ["Saison partagée (juil.–juin)", "Année civile (janv.–déc.)"] as const;
export type SeasonFormat = (typeof seasonFormats)[number];

const maxFieldLength = 120;

function normalizeOptional(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ValidationError("Champ de profil invalide.");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > maxFieldLength) {
    throw new ValidationError(`Un champ du profil dépasse ${maxFieldLength} caractères.`);
  }
  return trimmed;
}

// Un vrai `null` efface le champ ; une clé absente n'y touche pas -- d'où le tri des `undefined`.
function buildPatch(input: EducatorProfileInput): EducatorProfilePatch {
  const patch: EducatorProfilePatch = {};

  if (input.displayName !== undefined) {
    const trimmed = input.displayName.trim();
    if (!trimmed) {
      throw new ValidationError("Le nom ne peut pas être vide.");
    }
    if (trimmed.length > maxFieldLength) {
      throw new ValidationError(`Le nom dépasse ${maxFieldLength} caractères.`);
    }
    patch.displayName = trimmed;
  }

  if (input.birthDate !== undefined) {
    if (input.birthDate === null || input.birthDate.trim() === "") {
      patch.birthDate = null;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate.trim())) {
      throw new ValidationError("La date de naissance doit être au format AAAA-MM-JJ.");
    } else {
      patch.birthDate = input.birthDate.trim();
    }
  }

  for (const key of ["club", "country", "address", "phone", "diploma", "seasonFormat"] as const) {
    const normalized = normalizeOptional(input[key]);
    if (normalized !== undefined) {
      patch[key] = normalized;
    }
  }

  return patch;
}

export interface EducatorProfileInput {
  displayName?: string;
  birthDate?: string | null;
  club?: string | null;
  country?: string | null;
  address?: string | null;
  phone?: string | null;
  diploma?: string | null;
  seasonFormat?: string | null;
}

export class EducatorProfileService {
  constructor(private readonly educatorRepository: EducatorProfileRepository) {}

  async get(educatorId: string): Promise<EducatorProfile> {
    const profile = await this.educatorRepository.findProfileById(educatorId);
    if (!profile) {
      throw new EducatorNotFoundError();
    }
    return profile;
  }

  async update(educatorId: string, input: EducatorProfileInput): Promise<EducatorProfile> {
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    return this.educatorRepository.updateProfile(educatorId, buildPatch(input));
  }

  async changePassword(educatorId: string, currentPassword: string, newPassword: string): Promise<void> {
    const record = await this.educatorRepository.findAuthById(educatorId);
    if (!record) {
      throw new EducatorNotFoundError();
    }
    if (!(await verifyPassword(currentPassword, record.passwordHash))) {
      throw new InvalidCredentialsError();
    }
    let validated: string;
    try {
      validated = validatePassword(newPassword);
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : "Mot de passe invalide.");
    }
    await this.educatorRepository.updatePasswordHash(educatorId, await hashPassword(validated));
  }
}
