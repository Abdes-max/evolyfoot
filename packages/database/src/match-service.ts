import { formationForGameFormat, gameFormats, validateMatchPlan } from "@evolyfoot/domain";
import type { GameFormat, MatchLineupAssignment, MatchPlan, MatchVenue } from "@evolyfoot/domain";
import { EducatorNotFoundError, MatchNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, MatchRepository, PersistedMatch } from "./repositories";

function normalizeOpponent(opponent: string): string {
  const trimmed = opponent.trim();
  if (!trimmed) {
    throw new ValidationError("Indique l’équipe adverse.");
  }
  return trimmed;
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

// Reconstruit un MatchPlan (voir @evolyfoot/domain) à partir d'un match persisté, pour rejouer la
// validation du domaine côté serveur avant chaque écriture -- jamais faire confiance à une
// composition déjà validée telle quelle côté client.
function toMatchPlan(match: PersistedMatch, overrides: Partial<Pick<MatchPlan, "lineup" | "captainPlayerId">> = {}): MatchPlan {
  return {
    opponent: match.opponent,
    dateLabel: match.dateLabel,
    venue: match.venue,
    gameFormat: match.gameFormat,
    status: match.status,
    lineup: overrides.lineup ?? match.lineup,
    captainPlayerId: overrides.captainPlayerId !== undefined ? overrides.captainPlayerId : match.captainPlayerId,
  };
}

function validateLineupAgainstFormation(gameFormat: GameFormat, lineup: readonly MatchLineupAssignment[]): void {
  const validSlotIds = new Set(formationForGameFormat(gameFormat).map((slot) => slot.id));
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
    input: { opponent: string; dateLabel: string; venue: MatchVenue; gameFormat: number },
  ): Promise<PersistedMatch> {
    const opponent = normalizeOpponent(input.opponent);
    const dateLabel = normalizeDateLabel(input.dateLabel);
    const gameFormat = normalizeGameFormat(input.gameFormat);
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    return this.matchRepository.create(educatorId, { opponent, dateLabel, venue: input.venue, gameFormat });
  }

  // Composition et capitaine modifiables librement tant que le match n'est pas marqué joué --
  // ne rejoue que la cohérence structurelle (postes valides, pas de doublon), pas l'exigence
  // "composition complète + capitaine désigné" de `markPlayed` ci-dessous : une préparation en
  // cours a le droit d'être incomplète.
  async updateLineup(
    educatorId: string,
    matchId: string,
    input: { lineup: readonly MatchLineupAssignment[]; captainPlayerId: string | null },
  ): Promise<PersistedMatch> {
    const match = await this.get(educatorId, matchId);
    validateLineupAgainstFormation(match.gameFormat, input.lineup);
    if (input.captainPlayerId && !input.lineup.some((assignment) => assignment.playerId === input.captainPlayerId)) {
      throw new ValidationError("Le capitaine doit faire partie des titulaires.");
    }
    return this.matchRepository.update(matchId, educatorId, { lineup: input.lineup, captainPlayerId: input.captainPlayerId });
  }

  async markPlayed(educatorId: string, matchId: string): Promise<PersistedMatch> {
    const match = await this.get(educatorId, matchId);
    const errors = validateMatchPlan(toMatchPlan(match));
    if (Object.keys(errors).length > 0) {
      throw new ValidationError(Object.values(errors)[0]!);
    }
    return this.matchRepository.update(matchId, educatorId, { status: "played" });
  }

  async remove(educatorId: string, matchId: string): Promise<void> {
    return this.matchRepository.remove(matchId, educatorId);
  }
}
