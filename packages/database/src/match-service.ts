import { defaultFormationId, formationSlots, gameFormats, listFormations, maxSubstitutes, validateMatchPlan } from "@evolyfoot/domain";
import type { AttendanceEntry, GameFormat, MatchLineupAssignment, MatchPlan, MatchVenue } from "@evolyfoot/domain";
import { EducatorNotFoundError, MatchNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, MatchRepository, PersistedMatch } from "./repositories";

function normalizeOpponent(opponent: string): string {
  const trimmed = opponent.trim();
  if (!trimmed) {
    throw new ValidationError("Indique l’équipe adverse.");
  }
  return trimmed;
}

// Champ libre facultatif (rendez-vous, lieu, description) : une chaîne vide, absente ou déjà
// nulle devient `null` (le champ n'est pas renseigné), jamais une chaîne vide stockée telle quelle.
function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

// Rendez-vous exprimé en minutes avant le coup d'envoi (voir matchMeetingTime côté base) -- un
// entier positif ou nul, sinon `null` (non renseigné).
function normalizeMeetingOffset(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeDateLabel(dateLabel: string): string {
  const trimmed = dateLabel.trim();
  if (!trimmed) {
    throw new ValidationError("Indique une date.");
  }
  return trimmed;
}

function normalizeGameFormat(gameFormat: number): GameFormat {
  if (!gameFormats.includes(gameFormat as GameFormat)) {
    throw new ValidationError("Choisis un format de jeu, du foot à 4 au foot à 11.");
  }
  return gameFormat as GameFormat;
}

function normalizeFormationId(gameFormat: GameFormat, formationId: string | undefined): string {
  if (formationId === undefined) {
    return defaultFormationId(gameFormat);
  }
  if (!listFormations(gameFormat).some((formation) => formation.id === formationId)) {
    throw new ValidationError("Cette formation ne correspond pas au format de jeu.");
  }
  return formationId;
}

// Reconstruit un MatchPlan (voir @evolyfoot/domain) à partir d'un match persisté, pour rejouer la
// validation du domaine côté serveur avant chaque écriture -- jamais faire confiance à une
// composition déjà validée telle quelle côté client.
function toMatchPlan(
  match: PersistedMatch,
  overrides: Partial<Pick<MatchPlan, "lineup" | "captainPlayerId" | "formationId" | "substitutePlayerIds">> = {},
): MatchPlan {
  return {
    opponent: match.opponent,
    dateLabel: match.dateLabel,
    venue: match.venue,
    gameFormat: match.gameFormat,
    formationId: overrides.formationId ?? match.formationId,
    status: match.status,
    lineup: overrides.lineup ?? match.lineup,
    captainPlayerId: overrides.captainPlayerId !== undefined ? overrides.captainPlayerId : match.captainPlayerId,
    substitutePlayerIds: overrides.substitutePlayerIds ?? match.substitutePlayerIds,
  };
}

function validateSubstitutesAgainstLineup(
  lineup: readonly MatchLineupAssignment[],
  substitutePlayerIds: readonly string[],
): void {
  const starterIds = new Set(lineup.map((assignment) => assignment.playerId));
  const seen = new Set<string>();
  for (const playerId of substitutePlayerIds) {
    if (starterIds.has(playerId)) {
      throw new ValidationError("Un joueur ne peut être à la fois titulaire et remplaçant.");
    }
    if (seen.has(playerId)) {
      throw new ValidationError("Un même joueur ne peut être remplaçant qu’une fois.");
    }
    seen.add(playerId);
  }
}

function validateLineupAgainstFormation(
  gameFormat: GameFormat,
  formationId: string,
  lineup: readonly MatchLineupAssignment[],
): void {
  const validSlotIds = new Set(formationSlots(gameFormat, formationId).map((slot) => slot.id));
  const seenSlots = new Set<string>();
  const seenPlayers = new Set<string>();
  for (const assignment of lineup) {
    if (!validSlotIds.has(assignment.slotId)) {
      throw new ValidationError("Poste inconnu dans la composition.");
    }
    if (seenSlots.has(assignment.slotId)) {
      throw new ValidationError("Un même poste ne peut être occupé qu’une fois.");
    }
    if (seenPlayers.has(assignment.playerId)) {
      throw new ValidationError("Un même joueur ne peut occuper qu’un seul poste.");
    }
    seenSlots.add(assignment.slotId);
    seenPlayers.add(assignment.playerId);
  }
}

export class MatchService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly matchRepository: MatchRepository,
  ) {}

  async list(educatorId: string): Promise<PersistedMatch[]> {
    return this.matchRepository.listByEducator(educatorId);
  }

  async get(educatorId: string, matchId: string): Promise<PersistedMatch> {
    const match = await this.matchRepository.findById(matchId, educatorId);
    if (!match) {
      throw new MatchNotFoundError();
    }
    return match;
  }

  async create(
    educatorId: string,
    input: {
      opponent: string;
      dateLabel: string;
      // Vraie date calendaire (voir le commentaire dans schema.prisma), dérivée côté client du
      // datepicker de création -- optionnelle pour ne pas casser un appelant qui n'a que
      // `dateLabel` (voir la même tolérance côté TrainingSessionRepository.create).
      date?: Date | null;
      venue: MatchVenue;
      gameFormat: number;
      formationId?: string;
      meetingOffsetMinutes?: number | null;
      meetingTime?: string;
      location?: string;
      description?: string;
    },
  ): Promise<PersistedMatch> {
    const opponent = normalizeOpponent(input.opponent);
    const dateLabel = normalizeDateLabel(input.dateLabel);
    const gameFormat = normalizeGameFormat(input.gameFormat);
    const formationId = normalizeFormationId(gameFormat, input.formationId);
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    return this.matchRepository.create(educatorId, {
      opponent,
      dateLabel,
      date: input.date ?? null,
      meetingOffsetMinutes: normalizeMeetingOffset(input.meetingOffsetMinutes),
      venue: input.venue,
      gameFormat,
      formationId,
      meetingTime: normalizeOptionalText(input.meetingTime),
      location: normalizeOptionalText(input.location),
      description: normalizeOptionalText(input.description),
    });
  }

  // Rendez-vous (calculé à `date - meetingOffsetMinutes`, voir matchMeetingTime), lieu précis et
  // description -- modifiables indépendamment de la composition, avant comme après que le match
  // soit joué (une adresse ou une note reste correcte a posteriori, contrairement à la
  // composition qui décrit une prévision).
  async updateDetails(
    educatorId: string,
    matchId: string,
    input: {
      date?: Date | null;
      meetingOffsetMinutes?: number | null;
      meetingTime?: string | null;
      location?: string | null;
      description?: string | null;
    },
  ): Promise<PersistedMatch> {
    await this.get(educatorId, matchId);
    return this.matchRepository.update(matchId, educatorId, {
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.meetingOffsetMinutes !== undefined ? { meetingOffsetMinutes: normalizeMeetingOffset(input.meetingOffsetMinutes) } : {}),
      ...(input.meetingTime !== undefined ? { meetingTime: normalizeOptionalText(input.meetingTime) } : {}),
      ...(input.location !== undefined ? { location: normalizeOptionalText(input.location) } : {}),
      ...(input.description !== undefined ? { description: normalizeOptionalText(input.description) } : {}),
    });
  }

  // Composition et capitaine modifiables librement tant que le match n'est pas marqué joué --
  // ne rejoue que la cohérence structurelle (postes valides, pas de doublon), pas l'exigence
  // "composition complète + capitaine désigné" de `markPlayed` ci-dessous : une préparation en
  // cours a le droit d'être incomplète.
  async updateLineup(
    educatorId: string,
    matchId: string,
    input: {
      lineup: readonly MatchLineupAssignment[];
      captainPlayerId: string | null;
      substitutePlayerIds?: readonly string[];
    },
  ): Promise<PersistedMatch> {
    const match = await this.get(educatorId, matchId);
    validateLineupAgainstFormation(match.gameFormat, match.formationId, input.lineup);
    if (input.captainPlayerId && !input.lineup.some((assignment) => assignment.playerId === input.captainPlayerId)) {
      throw new ValidationError("Le capitaine doit faire partie des titulaires.");
    }
    const substitutePlayerIds = input.substitutePlayerIds ?? match.substitutePlayerIds;
    validateSubstitutesAgainstLineup(input.lineup, substitutePlayerIds);
    return this.matchRepository.update(matchId, educatorId, {
      lineup: input.lineup,
      captainPlayerId: input.captainPlayerId,
      substitutePlayerIds,
    });
  }

  // Change de formation, et/ou de format de jeu -- les postes diffèrent d'une formation à l'autre
  // (même pour un même format de jeu), donc repart d'une composition vide plutôt que de laisser
  // des affectations orphelines (même principe que `changeFormation` côté domaine, rejoué ici
  // côté serveur). Un format de jeu différent peut aussi réduire le nombre de remplaçants
  // autorisés (voir maxSubstitutes) : le banc est alors tronqué plutôt que rejeté en bloc.
  async changeFormation(
    educatorId: string,
    matchId: string,
    input: { formationId: string; gameFormat?: number },
  ): Promise<PersistedMatch> {
    const match = await this.get(educatorId, matchId);
    const gameFormat = input.gameFormat === undefined ? match.gameFormat : normalizeGameFormat(input.gameFormat);
    if (!listFormations(gameFormat).some((formation) => formation.id === input.formationId)) {
      throw new ValidationError("Cette formation ne correspond pas au format de jeu.");
    }
    const substitutePlayerIds = match.substitutePlayerIds.slice(0, maxSubstitutes(gameFormat));
    return this.matchRepository.update(matchId, educatorId, {
      gameFormat,
      formationId: input.formationId,
      lineup: [],
      captainPlayerId: null,
      substitutePlayerIds,
    });
  }

  async markPlayed(
    educatorId: string,
    matchId: string,
    attendance?: readonly AttendanceEntry[],
  ): Promise<PersistedMatch> {
    const match = await this.get(educatorId, matchId);
    const errors = validateMatchPlan(toMatchPlan(match));
    if (Object.keys(errors).length > 0) {
      throw new ValidationError(Object.values(errors)[0]!);
    }
    return this.matchRepository.update(matchId, educatorId, {
      status: "played",
      ...(attendance ? { attendance } : {}),
    });
  }

  async remove(educatorId: string, matchId: string): Promise<void> {
    return this.matchRepository.remove(matchId, educatorId);
  }
}
