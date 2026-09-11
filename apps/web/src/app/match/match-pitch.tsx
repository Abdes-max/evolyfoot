"use client";

import type { MatchLineupAssignment, MatchLineupSlot } from "@evolyfoot/domain";

interface MatchPitchProps {
  slots: ReadonlyArray<MatchLineupSlot>;
  lineup: ReadonlyArray<MatchLineupAssignment>;
  captainPlayerId: string | null;
  // Absent (ou omis) => terrain en lecture seule (match déjà joué). Sinon, appelé avec l'id du
  // poste touché -- match-prep-view.tsx ouvre alors le sélecteur de joueur correspondant.
  onSlotClick?: (slotId: string) => void;
  // Vide directement le poste (bouton "×" du pastille) sans repasser par le sélecteur -- distinct
  // de `onSlotClick` (qui ouvre le sélecteur pour AFFECTER ou changer un joueur).
  onSlotClear?: (slotId: string) => void;
}

// Réutilisé par les pastilles rondes du banc (match-prep-view.tsx), qui montrent des initiales
// plutôt que le prénom entier (voir onSlotClear ci-dessus, réservé au terrain).
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
export function MatchPitch({ slots, lineup, captainPlayerId, onSlotClick, onSlotClear }: MatchPitchProps) {
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

          if (!assignment) {
            // Poste vide : un vrai bouton (élément `<button>` natif) pour recevoir le focus
            // clavier et s'activer à Entrée/Espace sans réimplémenter cette sémantique.
            return (
              <button
                aria-label={`${slot.roleLabel} : aucun joueur, toucher pour affecter`}
                className="match-pitch-token empty"
                disabled={!onSlotClick}
                key={slot.id}
                onClick={() => onSlotClick?.(slot.id)}
                style={style}
                type="button"
              >
                {slot.roleLabel.slice(0, 1)}
              </button>
            );
          }

          // Poste occupé : le prénom entier plutôt que des initiales, avec une croix pour vider
          // le poste directement -- deux vrais boutons côte à côte (un `<button>` ne peut pas en
          // contenir un autre), le pastille elle-même n'étant donc plus un seul élément cliquable.
          return (
            <div className="match-pitch-token filled" key={slot.id} style={style}>
              <button
                aria-label={`${slot.roleLabel} : ${assignment.playerName}${isCaptain ? ", capitaine" : ""}`}
                className="match-pitch-token-name"
                disabled={!onSlotClick}
                onClick={() => onSlotClick?.(slot.id)}
                type="button"
              >
                {assignment.playerName}
              </button>
              {isCaptain && <span className="match-pitch-captain">C</span>}
              {onSlotClear && (
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
