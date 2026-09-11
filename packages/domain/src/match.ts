import type { GameFormat } from "./team";

export type MatchVenue = "home" | "away";
export type MatchStatus = "scheduled" | "played";
export type LineupRole = "goalkeeper" | "defender" | "midfielder" | "attacker";

// Un poste sur le terrain, positionné pour un affichage vertical (gardien en bas, attaque en
// haut) -- x/y en pourcentage d'un repère 300x460, indépendant de tout composant d'affichage
// (web en SVG, mobile en vues positionnées). Dérivé de la formation choisie à chaque lecture
// plutôt que stocké : si l'algorithme de formation change un jour, les matchs déjà préparés en
// bénéficient automatiquement, même principe que le plan de développement recalculé depuis le
// diagnostic.
export interface MatchLineupSlot {
  readonly id: string;
  readonly role: LineupRole;
  readonly roleLabel: string;
  readonly x: number;
  readonly y: number;
}

export interface MatchLineupAssignment {
  readonly slotId: string;
  readonly playerId: string;
  readonly playerName: string;
}

export interface Formation {
  readonly id: string;
  readonly label: string;
  readonly slots: ReadonlyArray<MatchLineupSlot>;
}

export interface MatchPlan {
  readonly opponent: string;
  readonly dateLabel: string;
  readonly venue: MatchVenue;
  readonly gameFormat: GameFormat;
  // Identifiant de la formation choisie parmi celles de `listFormations(gameFormat)` (ex.
  // "4-3-3") -- détermine les postes disponibles, voir `formationSlots`.
  readonly formationId: string;
  readonly status: MatchStatus;
  readonly lineup: ReadonlyArray<MatchLineupAssignment>;
  readonly captainPlayerId: string | null;
  // Sur le banc, sans poste (pas de position sur le terrain) -- un joueur ne peut être à la fois
  // titulaire et remplaçant, voir addSubstitute/assignPlayerToSlot.
  readonly substitutePlayerIds: ReadonlyArray<string>;
}

const roleLabels: Record<LineupRole, string> = {
  goalkeeper: "Gardien",
  defender: "Défenseur",
  midfielder: "Milieu",
  attacker: "Attaquant",
};

const rowY: Record<LineupRole, number> = { goalkeeper: 430, defender: 340, midfielder: 220, attacker: 90 };

type FormationRow = readonly [LineupRole, number];

interface FormationDefinition {
  readonly id: string;
  readonly label: string;
  readonly rows: ReadonlyArray<FormationRow>;
}

function outfieldRows(defenders: number, midfielders: number, attackers: number): FormationRow[] {
  const rows: FormationRow[] = [["goalkeeper", 1]];
  if (defenders > 0) rows.push(["defender", defenders]);
  if (midfielders > 0) rows.push(["midfielder", midfielders]);
  if (attackers > 0) rows.push(["attacker", attackers]);
  return rows;
}

// Plusieurs formations par format de jeu, chacune un partage plausible du nombre de joueurs de
// champ entre défense/milieu/attaque (des formations réelles, pas une génération combinatoire
// exhaustive qui produirait des répartitions absurdes). La première de chaque liste reste celle
// utilisée avant l'introduction du choix multiple : mêmes postes, mêmes identifiants, pour que les
// matchs déjà préparés restent valides.
const formationDefinitionsByGameFormat: Record<GameFormat, ReadonlyArray<FormationDefinition>> = {
  4: [
    { id: "1-1-1", label: "1-1-1", rows: outfieldRows(1, 1, 1) },
    { id: "2-1-0", label: "2-1-0", rows: outfieldRows(2, 1, 0) },
    { id: "2-0-1", label: "2-0-1", rows: outfieldRows(2, 0, 1) },
  ],
  5: [
    { id: "2-1-1", label: "2-1-1", rows: outfieldRows(2, 1, 1) },
    { id: "1-2-1", label: "1-2-1", rows: outfieldRows(1, 2, 1) },
    { id: "1-1-2", label: "1-1-2", rows: outfieldRows(1, 1, 2) },
    { id: "2-0-2", label: "2-0-2", rows: outfieldRows(2, 0, 2) },
  ],
  6: [
    { id: "2-2-1", label: "2-2-1", rows: outfieldRows(2, 2, 1) },
    { id: "2-1-2", label: "2-1-2", rows: outfieldRows(2, 1, 2) },
    { id: "1-3-1", label: "1-3-1", rows: outfieldRows(1, 3, 1) },
    { id: "3-1-1", label: "3-1-1", rows: outfieldRows(3, 1, 1) },
  ],
  7: [
    { id: "2-3-1", label: "2-3-1", rows: outfieldRows(2, 3, 1) },
    { id: "3-2-1", label: "3-2-1", rows: outfieldRows(3, 2, 1) },
    { id: "2-2-2", label: "2-2-2", rows: outfieldRows(2, 2, 2) },
    { id: "3-1-2", label: "3-1-2", rows: outfieldRows(3, 1, 2) },
  ],
  8: [
    { id: "3-3-1", label: "3-3-1", rows: outfieldRows(3, 3, 1) },
    { id: "2-3-2", label: "2-3-2", rows: outfieldRows(2, 3, 2) },
    { id: "3-2-2", label: "3-2-2", rows: outfieldRows(3, 2, 2) },
    { id: "2-4-1", label: "2-4-1", rows: outfieldRows(2, 4, 1) },
    { id: "4-2-1", label: "4-2-1", rows: outfieldRows(4, 2, 1) },
  ],
  9: [
    { id: "3-3-2", label: "3-3-2", rows: outfieldRows(3, 3, 2) },
    { id: "3-4-1", label: "3-4-1", rows: outfieldRows(3, 4, 1) },
    { id: "4-3-1", label: "4-3-1", rows: outfieldRows(4, 3, 1) },
    { id: "2-4-2", label: "2-4-2", rows: outfieldRows(2, 4, 2) },
  ],
  10: [
    { id: "4-3-2", label: "4-3-2", rows: outfieldRows(4, 3, 2) },
    { id: "3-4-2", label: "3-4-2", rows: outfieldRows(3, 4, 2) },
    { id: "4-4-1", label: "4-4-1", rows: outfieldRows(4, 4, 1) },
    { id: "3-3-3", label: "3-3-3", rows: outfieldRows(3, 3, 3) },
  ],
  11: [
    { id: "4-3-3", label: "4-3-3", rows: outfieldRows(4, 3, 3) },
    { id: "4-4-2", label: "4-4-2", rows: outfieldRows(4, 4, 2) },
    { id: "3-5-2", label: "3-5-2", rows: outfieldRows(3, 5, 2) },
    { id: "3-4-3", label: "3-4-3", rows: outfieldRows(3, 4, 3) },
    { id: "4-5-1", label: "4-5-1", rows: outfieldRows(4, 5, 1) },
    { id: "5-3-2", label: "5-3-2", rows: outfieldRows(5, 3, 2) },
  ],
};

function buildSlots(rows: ReadonlyArray<FormationRow>): MatchLineupSlot[] {
  const slots: MatchLineupSlot[] = [];
  for (const [role, count] of rows) {
    for (let index = 0; index < count; index += 1) {
      slots.push({
        id: `${role}-${index + 1}`,
        role,
        roleLabel: count > 1 ? `${roleLabels[role]} ${index + 1}` : roleLabels[role],
        x: ((index + 1) * 300) / (count + 1),
        y: rowY[role],
      });
    }
  }
  return slots;
}

export function listFormations(gameFormat: GameFormat): Formation[] {
  return formationDefinitionsByGameFormat[gameFormat].map((definition) => ({
    id: definition.id,
    label: definition.label,
    slots: buildSlots(definition.rows),
  }));
}

// Résout les postes d'une formation. Repli sur la première formation du format de jeu si
// `formationId` est absent ou ne correspond à aucune formation connue -- un match préparé avant
// l'introduction du choix multiple n'a pas de formationId enregistré, et doit continuer à afficher
// exactement la même formation qu'avant (voir le commentaire sur `formationDefinitionsByGameFormat`).
export function formationSlots(gameFormat: GameFormat, formationId?: string | null): ReadonlyArray<MatchLineupSlot> {
  const formations = listFormations(gameFormat);
  return (formations.find((formation) => formation.id === formationId) ?? formations[0]!).slots;
}

export function defaultFormationId(gameFormat: GameFormat): string {
  return formationDefinitionsByGameFormat[gameFormat][0]!.id;
}

export function createMatchPlan(
  opponent: string,
  dateLabel: string,
  venue: MatchVenue,
  gameFormat: GameFormat,
  formationId?: string,
): MatchPlan {
  return {
    opponent: opponent.trim(),
    dateLabel: dateLabel.trim(),
    venue,
    gameFormat,
    formationId: formationId ?? defaultFormationId(gameFormat),
    status: "scheduled",
    lineup: [],
    captainPlayerId: null,
    substitutePlayerIds: [],
  };
}

function withoutSlotAndPlayer(
  lineup: ReadonlyArray<MatchLineupAssignment>,
  slotId: string,
  playerId: string,
): MatchLineupAssignment[] {
  // Un joueur ne peut occuper qu'un seul poste à la fois : retire aussi toute affectation
  // précédente de ce même joueur ailleurs sur le terrain avant de le replacer sur `slotId`.
  return lineup.filter((assignment) => assignment.slotId !== slotId && assignment.playerId !== playerId);
}

export function assignPlayerToSlot(plan: MatchPlan, slotId: string, player: { id: string; name: string }): MatchPlan {
  const lineup = [...withoutSlotAndPlayer(plan.lineup, slotId, player.id), { slotId, playerId: player.id, playerName: player.name }];
  // Un joueur passe titulaire en quittant le banc, le cas échéant.
  const substitutePlayerIds = plan.substitutePlayerIds.filter((id) => id !== player.id);
  return { ...plan, lineup, substitutePlayerIds };
}

// Place un joueur sur le banc -- le retire d'abord de son poste s'il en occupait un (un joueur ne
// peut être à la fois titulaire et remplaçant), sans effet s'il y est déjà.
export function addSubstitute(plan: MatchPlan, player: { id: string; name: string }): MatchPlan {
  if (plan.substitutePlayerIds.includes(player.id)) {
    return plan;
  }
  const lineup = plan.lineup.filter((assignment) => assignment.playerId !== player.id);
  const captainPlayerId = plan.captainPlayerId === player.id ? null : plan.captainPlayerId;
  return { ...plan, lineup, captainPlayerId, substitutePlayerIds: [...plan.substitutePlayerIds, player.id] };
}

export function removeSubstitute(plan: MatchPlan, playerId: string): MatchPlan {
  return { ...plan, substitutePlayerIds: plan.substitutePlayerIds.filter((id) => id !== playerId) };
}

export function clearSlot(plan: MatchPlan, slotId: string): MatchPlan {
  const removed = plan.lineup.find((assignment) => assignment.slotId === slotId);
  const lineup = plan.lineup.filter((assignment) => assignment.slotId !== slotId);
  // Si le joueur retiré était capitaine, le titre ne survit pas sur le banc -- il faudra en
  // désigner un autre parmi les titulaires restants.
  const captainPlayerId = removed && plan.captainPlayerId === removed.playerId ? null : plan.captainPlayerId;
  return { ...plan, lineup, captainPlayerId };
}

export function setCaptain(plan: MatchPlan, playerId: string | null): MatchPlan {
  return { ...plan, captainPlayerId: playerId };
}

// Change de formation : les postes (et donc leurs identifiants) diffèrent d'une formation à
// l'autre pour un même format de jeu, une composition déjà commencée ne peut donc pas être
// reportée telle quelle -- repart d'une composition vide plutôt que de laisser des affectations
// orphelines pointer vers des postes qui n'existent plus.
export function changeFormation(plan: MatchPlan, formationId: string): MatchPlan {
  return { ...plan, formationId, lineup: [], captainPlayerId: null };
}

export function isLineupComplete(plan: MatchPlan): boolean {
  return plan.lineup.length === formationSlots(plan.gameFormat, plan.formationId).length;
}

export interface MatchPlanErrors {
  opponent?: string;
  dateLabel?: string;
  lineup?: string;
  captain?: string;
}

export function validateMatchPlan(plan: MatchPlan): MatchPlanErrors {
  const errors: MatchPlanErrors = {};
  if (!plan.opponent.trim()) {
    errors.opponent = "Indique l’équipe adverse.";
  }
  if (!plan.dateLabel.trim()) {
    errors.dateLabel = "Indique une date.";
  }
  if (!isLineupComplete(plan)) {
    errors.lineup = "Complète la composition avant de valider.";
  }
  if (!plan.captainPlayerId || !plan.lineup.some((assignment) => assignment.playerId === plan.captainPlayerId)) {
    errors.captain = "Désigne un capitaine parmi les titulaires.";
  }
  return errors;
}

export function canFinalizeMatchPlan(plan: MatchPlan): boolean {
  return Object.keys(validateMatchPlan(plan)).length === 0;
}
