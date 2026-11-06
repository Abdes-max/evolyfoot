"use client";

import type { PlayerSelection } from "@evolyfoot/domain";

export interface ConcernedPlayer {
  id: string;
  name: string;
}

// Joueurs concernés par un événement, cochés parmi l'effectif (tous par défaut). Tout cocher
// renvoie `null` (tout l'effectif, y compris les joueurs ajoutés plus tard), voir
// concerned-players.ts côté domaine.
export function ConcernedPlayersPicker({
  roster,
  value,
  onChange,
  title = "Joueurs concernés",
  hint,
}: {
  roster: readonly ConcernedPlayer[];
  value: PlayerSelection;
  onChange: (value: PlayerSelection) => void;
  title?: string;
  hint?: string;
}) {
  const checked = new Set(value ?? roster.map((player) => player.id));
  const count = roster.filter((player) => checked.has(player.id)).length;

  function toggle(playerId: string) {
    const next = new Set(checked);
    if (next.has(playerId)) next.delete(playerId);
    else next.add(playerId);
    const ids = roster.map((player) => player.id).filter((id) => next.has(id));
    onChange(ids.length === roster.length ? null : ids);
  }

  if (roster.length === 0) {
    return <p className="concerned-players-empty">Ajoute des joueurs à l’effectif pour choisir qui est concerné.</p>;
  }

  return (
    <fieldset className="concerned-players">
      <legend>
        {title} <span>{count === roster.length ? `tout l’effectif (${count})` : `${count} sur ${roster.length}`}</span>
      </legend>
      {hint && <p className="concerned-players-hint">{hint}</p>}
      <div className="concerned-players-actions">
        <button disabled={count === roster.length} onClick={() => onChange(null)} type="button">
          Tout cocher
        </button>
        <button disabled={count === 0} onClick={() => onChange([])} type="button">
          Tout décocher
        </button>
      </div>
      <div className="concerned-players-list">
        {roster.map((player) => (
          <label className={checked.has(player.id) ? "is-checked" : undefined} key={player.id}>
            <input checked={checked.has(player.id)} onChange={() => toggle(player.id)} type="checkbox" />
            <span>{player.name}</span>
          </label>
        ))}
      </div>
      {count === 0 && (
        <p className="field-error" role="alert">
          Coche au moins un joueur.
        </p>
      )}
    </fieldset>
  );
}
