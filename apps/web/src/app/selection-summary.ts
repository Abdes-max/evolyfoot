import type { PlayerSelection } from "@evolyfoot/domain";

// Résumé des joueurs concernés, visible même section repliée (comme dans l'app Coach).
export function selectionSummary(selection: PlayerSelection, rosterSize: number): string {
  if (selection === null) return `Tout l’effectif (${rosterSize})`;
  return `${selection.length} sur ${rosterSize}`;
}
