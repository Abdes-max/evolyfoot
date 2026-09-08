"use client";

import type { MatchLineupAssignment, MatchLineupSlot } from "@evolyfoot/domain";

interface MatchPitchProps {
  slots: ReadonlyArray<MatchLineupSlot>;
  lineup: ReadonlyArray<MatchLineupAssignment>;
  captainPlayerId: string | null;
  // Absent (ou omis) => terrain en lecture seule (match déjà joué). Sinon, appelé avec l'id du
  // poste touché -- match-prep-view.tsx ouvre alors le sélecteur de joueur correspondant.
  onSlotClick?: (slotId: string) => void;
}

function initials(name: string): string {
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
// téléphone en portrait pour une composition complète (gardien à but). Chaque poste est un vrai
// bouton (élément `<button>` en HTML natif, positionné par-dessus le SVG plutôt que dans le SVG
// lui-même -- un `<circle>`/`<g>` ne peut pas recevoir le focus clavier ni s'activer à Entrée ou
// Espace sans réimplémenter toute la sémantique d'un bouton).
export function MatchPitch({ slots, lineup, captainPlayerId, onSlotClick }: MatchPitchProps) {
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
          const label = assignment ? `${slot.roleLabel} : ${assignment.playerName}${isCaptain ? ", capitaine" : ""}` : `${slot.roleLabel} : aucun joueur, toucher pour affecter`;
          return (
            <button
              aria-label={label}
              className={`match-pitch-token ${assignment ? "filled" : "empty"}`}
              disabled={!onSlotClick}
              key={slot.id}
              onClick={() => onSlotClick?.(slot.id)}
              style={{ left: `${(slot.x / 300) * 100}%`, top: `${(slot.y / 460) * 100}%` }}
              type="button"
            >
              {assignment ? initials(assignment.playerName) : slot.roleLabel.slice(0, 1)}
              {isCaptain && <span className="match-pitch-captain">C</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
