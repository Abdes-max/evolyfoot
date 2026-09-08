"use client";

import type { MatchLineupAssignment, MatchLineupSlot } from "@evolyfoot/domain";

interface MatchPitchProps {
  slots: ReadonlyArray<MatchLineupSlot>;
  lineup: ReadonlyArray<MatchLineupAssignment>;
  captainPlayerId: string | null;
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

// Aperçu visuel, en lecture seule : l'affectation des postes se fait via la liste de sélecteurs
// juste en dessous (match-prep-view.tsx), pas en cliquant directement sur ce schéma -- les cibles
// tactiles seraient bien trop petites sur un terrain de 300px de large sur téléphone. Même langage
// visuel que les schémas tactiques de la bibliothèque (TacticalDiagramView), un terrain vertical
// plutôt qu'une zone d'entraînement horizontale : plus lisible sur un écran de téléphone en
// portrait pour une composition complète (gardien à but).
export function MatchPitch({ slots, lineup, captainPlayerId }: MatchPitchProps) {
  return (
    <div className="match-pitch">
      <svg aria-label="Composition sur le terrain" preserveAspectRatio="xMidYMid meet" role="img" viewBox="0 0 300 460">
        <rect className="match-pitch-turf" height="452" rx="16" width="292" x="4" y="4" />
        <line className="match-pitch-line" x1="4" x2="296" y1="230" y2="230" />
        <circle className="match-pitch-line" cx="150" cy="230" fill="none" r="40" />
        {slots.map((slot) => {
          const assignment = lineup.find((candidate) => candidate.slotId === slot.id);
          const isCaptain = Boolean(assignment && assignment.playerId === captainPlayerId);
          return (
            <g key={slot.id}>
              <circle className={`match-pitch-token ${assignment ? "filled" : "empty"}`} cx={slot.x} cy={slot.y} r="22" />
              <text className="match-pitch-label" textAnchor="middle" x={slot.x} y={slot.y + 5}>
                {assignment ? initials(assignment.playerName) : slot.roleLabel.slice(0, 1)}
              </text>
              {isCaptain && (
                <text className="match-pitch-captain" textAnchor="middle" x={slot.x + 20} y={slot.y - 16}>
                  C
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
