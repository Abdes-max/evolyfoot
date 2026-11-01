import { isValidJerseyNumber, playerFeet, playerPositions } from "@evolyfoot/domain";
import { EducatorNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, PersistedPlayer, PlayerDetailsPatch, PlayerRepository } from "./repositories";

function normalizeFirstName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError("Indique un prénom.");
  }
  return trimmed;
}

// `undefined` (paramètre omis) se replie silencieusement sur "" -- les très nombreux appels
// directs au repository dans les fixtures de test n'ont besoin que d'un nom d'affichage
// quelconque (voir le commentaire sur PlayerRepository.create). Une chaîne vide fournie
// explicitement (formulaire réel : ajout ou fiche détail) est en revanche rejetée -- la fiche
// joueur exige toujours prénom ET nom dès qu'on les renseigne.
function normalizeLastName(value: string | undefined): string {
  if (value === undefined) {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError("Indique un nom.");
  }
  return trimmed;
}

const maxFieldLength = 200;
const maxNoteLength = 1000;
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
  firstName?: string;
  lastName?: string;
  photo?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  position?: string | null;
  jerseyNumber?: string | null;
  preferredFoot?: string | null;
  strengths?: string | null;
  workAreas?: string | null;
}

function normalizeChoice(value: string | null | undefined, allowed: readonly string[], message: string): string | null | undefined {
  const normalized = normalizeOptional(value, maxFieldLength);
  if (normalized && !allowed.includes(normalized)) {
    throw new ValidationError(message);
  }
  return normalized;
}

export class RosterService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly playerRepository: PlayerRepository,
  ) {}

  async list(educatorId: string): Promise<PersistedPlayer[]> {
    return this.playerRepository.listByEducator(educatorId);
  }

  async add(educatorId: string, firstName: string, lastName?: string): Promise<PersistedPlayer> {
    const trimmedFirstName = normalizeFirstName(firstName);
    const trimmedLastName = normalizeLastName(lastName);
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    return this.playerRepository.create(educatorId, trimmedFirstName, trimmedLastName);
  }

  async rename(educatorId: string, playerId: string, firstName: string, lastName?: string): Promise<PersistedPlayer> {
    const trimmedFirstName = normalizeFirstName(firstName);
    const trimmedLastName = normalizeLastName(lastName);
    return this.playerRepository.rename(playerId, educatorId, trimmedFirstName, trimmedLastName);
  }

  async updateDetails(educatorId: string, playerId: string, input: PlayerDetailsInput): Promise<PersistedPlayer> {
    const patch: PlayerDetailsPatch = {};
    if (input.firstName !== undefined) {
      patch.firstName = normalizeFirstName(input.firstName);
    }
    if (input.lastName !== undefined) {
      patch.lastName = normalizeLastName(input.lastName);
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
    const position = normalizeChoice(input.position, playerPositions, "Ce poste n’existe pas.");
    if (position !== undefined) {
      patch.position = position;
    }
    const preferredFoot = normalizeChoice(input.preferredFoot, playerFeet, "Ce pied fort n’existe pas.");
    if (preferredFoot !== undefined) {
      patch.preferredFoot = preferredFoot;
    }
    const jerseyNumber = normalizeOptional(input.jerseyNumber, maxFieldLength);
    if (jerseyNumber !== undefined) {
      if (jerseyNumber !== null && !isValidJerseyNumber(jerseyNumber)) {
        throw new ValidationError("Le numéro doit compter un ou deux chiffres.");
      }
      patch.jerseyNumber = jerseyNumber;
    }
    const strengths = normalizeOptional(input.strengths, maxNoteLength);
    if (strengths !== undefined) {
      patch.strengths = strengths;
    }
    const workAreas = normalizeOptional(input.workAreas, maxNoteLength);
    if (workAreas !== undefined) {
      patch.workAreas = workAreas;
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
