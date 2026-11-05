"use client";

import { playerPositionCodes, playerPositions } from "@evolyfoot/domain";
import { useEffect, useRef, useState } from "react";

export interface PickablePlayer {
  id: string;
  name: string;
  photo?: string | null;
  position?: string | null;
  jerseyNumber?: string | null;
}

interface PlayerPickerProps {
  title: string;
  players: ReadonlyArray<PickablePlayer>;
  // Statut affiché à côté du poste (« déjà titulaire », « remplaçant ») : choisir ce joueur le
  // déplace, voir assignPlayerToSlot côté domaine.
  statusOf?: (playerId: string) => string | null;
  currentPlayerId?: string | null;
  onPick: (playerId: string) => void;
  onClear?: () => void;
  // Brassard : nommer (ou retirer) le joueur du poste comme capitaine, sans quitter la fenêtre.
  captainPlayerId?: string | null;
  onToggleCaptain?: (playerId: string) => void;
  onClose: () => void;
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

function positionLabel(position: string | null | undefined): string {
  if (!position || !(playerPositions as readonly string[]).includes(position)) return "Poste à renseigner";
  return `${position} (${playerPositionCodes[position as keyof typeof playerPositionCodes]})`;
}

// Fenêtre « Choisir un joueur » de la composition : recherche, puis une ligne par joueur avec sa
// photo ou ses initiales, son poste et son numéro de maillot. Remplace l'ancien <select> natif,
// qui ne montrait que les noms.
export function PlayerPicker({ title, players, statusOf, currentPlayerId, onPick, onClear, onClose, captainPlayerId, onToggleCaptain }: PlayerPickerProps) {
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    dialog.current?.querySelector("input")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const needle = query.trim().toLocaleLowerCase("fr");
  const shown = players.filter((player) => !needle || player.name.toLocaleLowerCase("fr").includes(needle));

  return (
    <div className="player-picker-backdrop" onClick={onClose} role="presentation">
      <div aria-label={title} aria-modal="true" className="player-picker" onClick={(event) => event.stopPropagation()} ref={dialog} role="dialog">
        <div className="player-picker-head">
          <h2>{title}</h2>
          <button aria-label="Fermer" className="player-picker-close" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <input
          aria-label="Rechercher un joueur"
          className="player-picker-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un joueur"
          type="search"
          value={query}
        />
        {currentPlayerId && onToggleCaptain && (
          <button
            aria-pressed={captainPlayerId === currentPlayerId}
            className={captainPlayerId === currentPlayerId ? "player-picker-captain active" : "player-picker-captain"}
            onClick={() => onToggleCaptain(currentPlayerId)}
            type="button"
          >
            <span aria-hidden="true" className="player-picker-captain-badge">
              C
            </span>
            {captainPlayerId === currentPlayerId
              ? `${players.find((player) => player.id === currentPlayerId)?.name ?? "Ce joueur"} est capitaine · retirer le brassard`
              : `Nommer ${players.find((player) => player.id === currentPlayerId)?.name ?? "ce joueur"} capitaine`}
          </button>
        )}
        <ul className="player-picker-list">
          {currentPlayerId && onClear && (
            <li>
              <button className="player-picker-row player-picker-clear" onClick={onClear} type="button">
                Laisser le poste libre
              </button>
            </li>
          )}
          {shown.map((player) => {
            const status = statusOf?.(player.id) ?? null;
            return (
              <li key={player.id}>
                <button
                  aria-current={player.id === currentPlayerId ? "true" : undefined}
                  className={player.id === currentPlayerId ? "player-picker-row current" : "player-picker-row"}
                  onClick={() => onPick(player.id)}
                  type="button"
                >
                  <span aria-hidden="true" className="player-picker-avatar">
                    {player.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={player.photo} />
                    ) : (
                      initials(player.name)
                    )}
                  </span>
                  <span className="player-picker-identity">
                    <strong>
                      {player.name}
                      {player.id === captainPlayerId && <span className="player-picker-captain-badge small">C</span>}
                    </strong>
                    <small>
                      {positionLabel(player.position)}
                      {status && <em> · {status}</em>}
                    </small>
                  </span>
                  <span aria-hidden="true" className="player-picker-number">
                    {player.jerseyNumber || ""}
                  </span>
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="player-picker-empty">Aucun joueur ne correspond.</li>}
        </ul>
      </div>
    </div>
  );
}
