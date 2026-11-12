import { defaultFormationId, formationSlots, listFormations, maxSubstitutes, transferLineup, type MatchLineupAssignment } from "./match";
import { gameFormats, type GameFormat } from "./team";

// Composition d'un tournoi ou d'un plateau : une seule feuille pour la journée (format de jeu,
// formation, titulaires, capitaine, remplaçants), comme celle d'un match.
export interface CompetitionLineup {
  readonly gameFormat: GameFormat;
  readonly formationId: string;
  readonly lineup: readonly MatchLineupAssignment[];
  readonly captainPlayerId: string | null;
  readonly substitutePlayerIds: readonly string[];
}

export function emptyCompetitionLineup(gameFormat: GameFormat): CompetitionLineup {
  return { gameFormat, formationId: defaultFormationId(gameFormat), lineup: [], captainPlayerId: null, substitutePlayerIds: [] };
}

function isGameFormat(value: unknown): value is GameFormat {
  return typeof value === "number" && (gameFormats as readonly number[]).includes(value);
}

// Lecture tolérante (colonne JSON) : null si la valeur n'a pas la forme attendue.
export function parseCompetitionLineup(value: unknown): CompetitionLineup | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (!isGameFormat(raw.gameFormat) || typeof raw.formationId !== "string") return null;
  const lineup = Array.isArray(raw.lineup)
    ? raw.lineup.filter(
        (entry): entry is MatchLineupAssignment =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as MatchLineupAssignment).slotId === "string" &&
          typeof (entry as MatchLineupAssignment).playerId === "string" &&
          typeof (entry as MatchLineupAssignment).playerName === "string",
      )
    : [];
  return {
    gameFormat: raw.gameFormat,
    formationId: raw.formationId,
    lineup: lineup.map(({ slotId, playerId, playerName }) => ({ slotId, playerId, playerName })),
    captainPlayerId: typeof raw.captainPlayerId === "string" ? raw.captainPlayerId : null,
    substitutePlayerIds: Array.isArray(raw.substitutePlayerIds) ? raw.substitutePlayerIds.filter((id): id is string => typeof id === "string") : [],
  };
}

// Première incohérence trouvée, ou null : formation du format, postes et joueurs uniques, capitaine
// titulaire, banc sans titulaire ni doublon et dans la limite du format.
export function validateCompetitionLineup(value: CompetitionLineup): string | null {
  if (!listFormations(value.gameFormat).some((formation) => formation.id === value.formationId)) {
    return "Cette formation ne correspond pas au format de jeu.";
  }
  const slotIds = new Set(formationSlots(value.gameFormat, value.formationId).map((slot) => slot.id));
  const seenSlots = new Set<string>();
  const starters = new Set<string>();
  for (const assignment of value.lineup) {
    if (!slotIds.has(assignment.slotId)) return "Poste inconnu dans la composition.";
    if (seenSlots.has(assignment.slotId)) return "Un même poste ne peut être occupé qu’une fois.";
    if (starters.has(assignment.playerId)) return "Un même joueur ne peut occuper qu’un seul poste.";
    seenSlots.add(assignment.slotId);
    starters.add(assignment.playerId);
  }
  if (value.captainPlayerId && !starters.has(value.captainPlayerId)) return "Le capitaine doit faire partie des titulaires.";
  if (value.substitutePlayerIds.length > maxSubstitutes(value.gameFormat)) {
    return `${maxSubstitutes(value.gameFormat)} remplaçants au plus en foot à ${value.gameFormat}.`;
  }
  const bench = new Set<string>();
  for (const playerId of value.substitutePlayerIds) {
    if (starters.has(playerId)) return "Un joueur ne peut être à la fois titulaire et remplaçant.";
    if (bench.has(playerId)) return "Un même joueur ne peut être remplaçant qu’une fois.";
    bench.add(playerId);
  }
  return null;
}

// Nouveau format et/ou nouvelle formation : les titulaires suivent sur les postes les plus proches,
// ceux qui n'ont plus de place passent sur le banc tant qu'il en reste.
export function changeCompetitionFormation(value: CompetitionLineup, gameFormat: GameFormat, formationId: string): CompetitionLineup {
  const { lineup, leftOver } = transferLineup(value.lineup, formationSlots(value.gameFormat, value.formationId), formationSlots(gameFormat, formationId));
  const substitutePlayerIds = [...value.substitutePlayerIds, ...leftOver.map((assignment) => assignment.playerId)].slice(0, maxSubstitutes(gameFormat));
  const captainPlayerId = lineup.some((assignment) => assignment.playerId === value.captainPlayerId) ? value.captainPlayerId : null;
  return { gameFormat, formationId, lineup, captainPlayerId, substitutePlayerIds };
}
