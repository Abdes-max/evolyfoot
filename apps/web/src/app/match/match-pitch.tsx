"use client";

import type { MatchLineupAssignment, MatchLineupSlot } from "@evolyfoot/domain";
import { useState } from "react";
import { PlayerPicker, type PickablePlayer } from "./player-picker";

type RosterPlayer = PickablePlayer;

interface MatchPitchProps {
  slots: ReadonlyArray<MatchLineupSlot>;
  lineup: ReadonlyArray<MatchLineupAssignment>;
  captainPlayerId: string | null;
  // Effectif complet (poste, numéro, photo) pour la fenêtre de choix et les numéros sur le terrain.
  roster?: ReadonlyArray<RosterPlayer>;
  // Remplaçants actuels, signalés dans la fenêtre de choix.
  substitutePlayerIds?: ReadonlyArray<string>;
  // Liste des postes à côté du terrain (fiche match) ; absente sur le mini-terrain de l’accueil.
  showList?: boolean;
  // Affecte (ou change) le joueur d'un poste.
  onSlotAssign?: (slotId: string, playerId: string) => void;
  // Vide le poste (« Laisser le poste libre » ou « × » dans la liste).
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
// Toucher un poste (sur le terrain ou dans la liste à côté) ouvre la fenêtre « Choisir un joueur »
// (player-picker.tsx) : recherche, poste et numéro de chaque joueur. Un poste occupé affiche le
// numéro de maillot du joueur (ses initiales à défaut), un poste libre un « + ».
export function MatchPitch({
  slots,
  lineup,
  captainPlayerId,
  roster = [],
  substitutePlayerIds = [],
  onSlotAssign,
  onSlotClear,
  showList = false,
}: MatchPitchProps) {
  const readOnly = !onSlotAssign;
  const [pickingSlotId, setPickingSlotId] = useState<string | null>(null);
  const playerById = new Map(roster.map((player) => [player.id, player]));
  const pickingSlot = slots.find((slot) => slot.id === pickingSlotId) ?? null;
  const pickingAssignment = pickingSlot ? lineup.find((candidate) => candidate.slotId === pickingSlot.id) : undefined;

  function tokenText(assignment: MatchLineupAssignment): string {
    return playerById.get(assignment.playerId)?.jerseyNumber || initials(assignment.playerName);
  }

  function statusOf(playerId: string): string | null {
    const elsewhere = lineup.find((candidate) => candidate.playerId === playerId && candidate.slotId !== pickingSlotId);
    if (elsewhere) return "déjà titulaire";
    return substitutePlayerIds.includes(playerId) ? "remplaçant" : null;
  }

  return (
    <div className={showList ? "match-pitch-with-list" : undefined}>
      <div className="match-pitch">
        <svg aria-hidden="true" preserveAspectRatio="xMidYMid meet" viewBox="0 0 300 460">
          <rect className="match-pitch-turf" height="452" rx="16" width="292" x="4" y="4" />
          <line className="match-pitch-line" x1="4" x2="296" y1="230" y2="230" />
          <circle className="match-pitch-line" cx="150" cy="230" fill="none" r="40" />
          <rect className="match-pitch-line" fill="none" height="60" width="140" x="80" y="4" />
          <rect className="match-pitch-line" fill="none" height="60" width="140" x="80" y="396" />
        </svg>
        <div aria-label="Composition sur le terrain" className="match-pitch-tokens" role="group">
          {slots.map((slot) => {
            const assignment = lineup.find((candidate) => candidate.slotId === slot.id);
            const isCaptain = Boolean(assignment && assignment.playerId === captainPlayerId);
            const style = { left: `${(slot.x / 300) * 100}%`, top: `${(slot.y / 460) * 100}%` };
            const label = `${slot.roleLabel} : ${assignment ? assignment.playerName : "aucun joueur"}${readOnly ? "" : ", toucher pour affecter"}`;
            return (
              <div className={assignment ? "match-pitch-token filled" : "match-pitch-token empty"} key={slot.id} style={style}>
                {readOnly ? (
                  <span aria-label={label} className="match-pitch-token-face" role="img">
                    {assignment ? tokenText(assignment) : slot.roleLabel.slice(0, 1)}
                  </span>
                ) : (
                  <button aria-label={label} className="match-pitch-token-face" onClick={() => setPickingSlotId(slot.id)} type="button">
                    {assignment ? tokenText(assignment) : "+"}
                  </button>
                )}
                {isCaptain && <span className="match-pitch-captain">C</span>}
              </div>
            );
          })}
        </div>
      </div>

      {showList && (
        <ol aria-label="Postes de la composition" className="match-lineup-list">
          {slots.map((slot) => {
            const assignment = lineup.find((candidate) => candidate.slotId === slot.id);
            const code = slot.roleLabel === "Gardien" ? "G" : slot.roleLabel.slice(0, 3).toUpperCase();
            return (
              <li key={slot.id}>
                <button className="match-lineup-row" disabled={readOnly} onClick={() => setPickingSlotId(slot.id)} type="button">
                  <span className="match-lineup-code">{code}</span>
                  <span className={assignment ? "match-lineup-name" : "match-lineup-name free"}>{assignment ? assignment.playerName : "Poste libre"}</span>
                </button>
                {assignment && onSlotClear && (
                  <button
                    aria-label={`Retirer ${assignment.playerName} de ce poste`}
                    className="match-lineup-remove"
                    onClick={() => onSlotClear(slot.id)}
                    type="button"
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {pickingSlot && onSlotAssign && (
        <PlayerPicker
          currentPlayerId={pickingAssignment?.playerId ?? null}
          onClear={
            onSlotClear
              ? () => {
                  onSlotClear(pickingSlot.id);
                  setPickingSlotId(null);
                }
              : undefined
          }
          onClose={() => setPickingSlotId(null)}
          onPick={(playerId) => {
            onSlotAssign(pickingSlot.id, playerId);
            setPickingSlotId(null);
          }}
          players={roster}
          statusOf={statusOf}
          title={`Choisir un joueur · ${pickingSlot.roleLabel}`}
        />
      )}
    </div>
  );
}
