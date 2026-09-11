"use client";

import type { MatchLineupAssignment, MatchLineupSlot } from "@evolyfoot/domain";

interface RosterPlayer {
  id: string;
  name: string;
}

interface MatchPitchProps {
  slots: ReadonlyArray<MatchLineupSlot>;
  lineup: ReadonlyArray<MatchLineupAssignment>;
  captainPlayerId: string | null;
  // Effectif complet, pour construire les options du sélecteur superposé à chaque poste -- absent
  // (ou omis) => terrain en lecture seule (match déjà joué), voir `readOnly` ci-dessous.
  roster?: ReadonlyArray<RosterPlayer>;
  // Affecte (ou change) le joueur d'un poste.
  onSlotAssign?: (slotId: string, playerId: string) => void;
  // Vide directement le poste (bouton "×" de la pastille) sans repasser par le sélecteur.
  onSlotClear?: (slotId: string) => void;
}

// Réutilisé par les pastilles rondes du banc (match-prep-view.tsx), qui montrent des initiales
// plutôt que le prénom entier.
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

// Même langage visuel que les schémas tactiques de la bibliothèque (TacticalDiagramView), un
// terrain vertical plutôt qu'une zone d'entraînement horizontale : plus lisible sur un écran de
// téléphone en portrait pour une composition complète (gardien à but).
//
// Chaque poste superpose un vrai <select> (invisible, mais dans le flux -- jamais display:none)
// à la pastille visible : le tap de l'utilisateur porte alors directement sur l'élément de
// formulaire natif, ce qui garantit l'ouverture du sélecteur sur tous les navigateurs, y compris
// mobile (Safari iOS n'ouvre pas un <select> caché via showPicker()/focus() programmatique --
// seul un vrai geste utilisateur sur l'élément lui-même le fait). C'est ce qui causait le bug
// « le secteur de joueur est introuvable » : le clic touchait un bouton décoratif qui tentait
// d'ouvrir un <select> distinct par showPicker()/focus(), sans effet visible sur certains
// navigateurs.
export function MatchPitch({ slots, lineup, captainPlayerId, roster = [], onSlotAssign, onSlotClear }: MatchPitchProps) {
  const readOnly = !onSlotAssign;
  const assignedPlayerIds = new Set(lineup.map((assignment) => assignment.playerId));

  return (
    <div className="match-pitch">
      <svg aria-hidden="true" preserveAspectRatio="xMidYMid meet" viewBox="0 0 300 460">
        <rect className="match-pitch-turf" height="452" rx="16" width="292" x="4" y="4" />
        <line className="match-pitch-line" x1="4" x2="296" y1="230" y2="230" />
        <circle className="match-pitch-line" cx="150" cy="230" fill="none" r="40" />
      </svg>
      <div aria-label="Composition sur le terrain" className="match-pitch-tokens" role="group">
        {slots.map((slot) => {
          const assignment = lineup.find((candidate) => candidate.slotId === slot.id);
          const isCaptain = Boolean(assignment && assignment.playerId === captainPlayerId);
          const style = { left: `${(slot.x / 300) * 100}%`, top: `${(slot.y / 460) * 100}%` };
          const availablePlayers = roster.filter(
            (player) => player.id === assignment?.playerId || !assignedPlayerIds.has(player.id),
          );

          return (
            <div
              className={assignment ? "match-pitch-token filled" : "match-pitch-token empty"}
              key={slot.id}
              style={style}
            >
              {!readOnly && (
                <select
                  aria-label={`${slot.roleLabel} : ${assignment ? assignment.playerName : "aucun joueur"}, toucher pour affecter`}
                  className="match-pitch-token-select"
                  onChange={(event) => onSlotAssign?.(slot.id, event.target.value)}
                  value={assignment?.playerId ?? ""}
                >
                  <option value="">— Aucun joueur —</option>
                  {availablePlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              )}
              {assignment ? (
                <span className="match-pitch-token-name">{assignment.playerName}</span>
              ) : (
                <span aria-hidden="true">{slot.roleLabel.slice(0, 1)}</span>
              )}
              {isCaptain && <span className="match-pitch-captain">C</span>}
              {assignment && onSlotClear && (
                <button
                  aria-label={`Retirer ${assignment.playerName} de ce poste`}
                  className="match-pitch-token-remove"
                  onClick={() => onSlotClear(slot.id)}
                  type="button"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
