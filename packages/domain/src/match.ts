import type { GameFormat } from "./team";

export type MatchVenue = "home" | "away";
export type MatchStatus = "scheduled" | "played";
export type LineupRole = "goalkeeper" | "defender" | "midfielder" | "attacker";

// Un poste sur le terrain, positionné pour un affichage vertical (gardien en bas, attaque en
// haut) -- x/y en pourcentage d'un repère 300x460, indépendant de tout composant d'affichage
// (web en SVG, mobile en vues positionnées). Dérivé du format de jeu à chaque lecture plutôt que
// stocké : si l'algorithme de formation change un jour, les matchs déjà préparés en bénéficient
// automatiquement, même principe que le plan de développement recalculé depuis le diagnostic.
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

export interface MatchPlan {
  readonly opponent: string;
  readonly dateLabel: string;
  readonly venue: MatchVenue;
  readonly gameFormat: GameFormat;
  readonly status: MatchStatus;
  readonly lineup: ReadonlyArray<MatchLineupAssignment>;
  readonly captainPlayerId: string | null;
}

const roleLabels: Record<LineupRole, string> = {
  goalkeeper: "Gardien",
  defender: "Défenseur",
  midfielder: "Milieu",
  attacker: "Attaquant",
};

// Une seule formation par format de jeu, pas de choix multiple : garde la préparation rapide et
// reste cohérent avec le reste de l'application (un seul diagnostic actif, un seul plan actif...).
const rowsByGameFormat: Record<GameFormat, ReadonlyArray<readonly [LineupRole, number]>> = {
  4: [
    ["goalkeeper", 1],
    ["defender", 1],
    ["midfielder", 1],
    ["attacker", 1],
  ],
  5: [
    ["goalkeeper", 1],
    ["defender", 2],
    ["midfielder", 1],
    ["attacker", 1],
  ],
  6: [
    ["goalkeeper", 1],
    ["defender", 2],
    ["midfielder", 2],
    ["attacker", 1],
  ],
  7: [
    ["goalkeeper", 1],
    ["defender", 2],
    ["midfielder", 3],
    ["attacker", 1],
  ],
  8: [
    ["goalkeeper", 1],
    ["defender", 3],
    ["midfielder", 3],
    ["attacker", 1],
  ],
  9: [
    ["goalkeeper", 1],
    ["defender", 3],
    ["midfielder", 3],
    ["attacker", 2],
  ],
  10: [
    ["goalkeeper", 1],
    ["defender", 4],
    ["midfielder", 3],
    ["attacker", 2],
  ],
  11: [
    ["goalkeeper", 1],
    ["defender", 4],
    ["midfielder", 3],
    ["attacker", 3],
  ],
};

const rowY: Record<LineupRole, number> = { goalkeeper: 430, defender: 340, midfielder: 220, attacker: 90 };

export function formationForGameFormat(gameFormat: GameFormat): MatchLineupSlot[] {
  const rows = rowsByGameFormat[gameFormat];
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

export function createMatchPlan(opponent: string, dateLabel: string, venue: MatchVenue, gameFormat: GameFormat): MatchPlan {
  return { opponent: opponent.trim(), dateLabel: dateLabel.trim(), venue, gameFormat, status: "scheduled", lineup: [], captainPlayerId: null };
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
  return { ...plan, lineup };
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

export function isLineupComplete(plan: MatchPlan): boolean {
  return plan.lineup.length === formationForGameFormat(plan.gameFormat).length;
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
