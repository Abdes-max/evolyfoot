"use client";

import { competitionGamesMax, competitionRecordLabel, matchResultMaxGoals, validateCompetitionGames, type CompetitionGame } from "@evolyfoot/domain";
import { useRef, useState } from "react";

interface DraftGame {
  id: string;
  opponent: string;
  goalsFor: number;
  goalsAgainst: number;
  stats: ReadonlyMap<string, { goals: number; assists: number }>;
}

function toDraft(game: CompetitionGame): DraftGame {
  return {
    id: game.id,
    opponent: game.opponent,
    goalsFor: game.goalsFor,
    goalsAgainst: game.goalsAgainst,
    stats: new Map(game.playerStats.map((stat) => [stat.playerId, { goals: stat.goals, assists: stat.assists }])),
  };
}

// Rencontres d'un tournoi ou d'un plateau, comme dans l'app Coach : l'équipe rencontrée, le score, et
// pour chaque rencontre les buteurs et passeurs parmi les joueurs concernés. Tout s'enregistre en un geste.
export function CompetitionGames({
  gamesUrl,
  games,
  players,
  onSaved,
}: {
  gamesUrl: string;
  games: readonly CompetitionGame[];
  players: readonly { id: string; name: string }[];
  onSaved: (games: CompetitionGame[]) => void;
}) {
  const counter = useRef(0);
  const [drafts, setDrafts] = useState<DraftGame[]>(() => games.map(toDraft));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  function change(id: string, patch: Partial<DraftGame>) {
    setFeedback("");
    setError("");
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  function changeStat(id: string, playerId: string, field: "goals" | "assists", value: number) {
    setFeedback("");
    setError("");
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== id) return draft;
        const stats = new Map(draft.stats);
        stats.set(playerId, { goals: 0, assists: 0, ...stats.get(playerId), [field]: value });
        return { ...draft, stats };
      }),
    );
  }

  // Seuls les joueurs ayant marqué ou fait une passe sont enregistrés.
  function toGames(): CompetitionGame[] {
    return drafts.map((draft) => ({
      id: draft.id,
      opponent: draft.opponent.trim(),
      goalsFor: draft.goalsFor,
      goalsAgainst: draft.goalsAgainst,
      playerStats: players.flatMap((player) => {
        const stat = draft.stats.get(player.id);
        return stat && (stat.goals > 0 || stat.assists > 0) ? [{ playerId: player.id, playerName: player.name, goals: stat.goals, assists: stat.assists }] : [];
      }),
    }));
  }

  async function save() {
    const next = toGames();
    const problem = validateCompetitionGames(next);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      const response = await fetch(gamesUrl, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ games: next }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(typeof body?.error === "string" ? body.error : "L’enregistrement a échoué, réessaie.");
        return;
      }
      setFeedback("Rencontres enregistrées : les stats des joueurs sont à jour dans l’espace joueur.");
      onSaved(Array.isArray(body?.games) ? body.games : next);
    } catch {
      setError("L’enregistrement a échoué, réessaie.");
    } finally {
      setSaving(false);
    }
  }

  function add() {
    counter.current += 1;
    setDrafts((current) => [
      ...current,
      { id: `g-${Date.now().toString(36)}-${counter.current}`, opponent: "", goalsFor: 0, goalsAgainst: 0, stats: new Map() },
    ]);
    setFeedback("");
  }

  const record = competitionRecordLabel(toGames());
  const goalsInput = (label: string, value: number, onChange: (value: number) => void) => (
    <input aria-label={label} max={matchResultMaxGoals} min={0} onChange={(event) => onChange(Number(event.target.value))} type="number" value={value} />
  );

  return (
    <div className="competition-games">
      {record && <p className="competition-games-record">{record}</p>}
      {drafts.length === 0 && (
        <p className="match-slot-hint">Aucune rencontre pour l’instant. Ajoute les matchs joués, avec l’équipe rencontrée et le score.</p>
      )}
      {drafts.map((draft, index) => (
        <section className="competition-game" key={draft.id}>
          <div className="competition-game-head">
            <h3>Rencontre {index + 1}</h3>
            <button className="text-button" onClick={() => setDrafts((current) => current.filter((other) => other.id !== draft.id))} type="button">
              Retirer
            </button>
          </div>
          <input
            aria-label={`Équipe rencontrée, rencontre ${index + 1}`}
            className="competition-game-opponent"
            maxLength={60}
            onChange={(event) => change(draft.id, { opponent: event.target.value })}
            placeholder="Équipe rencontrée"
            value={draft.opponent}
          />
          <div className="match-result-score">
            <label>
              <span>Nous</span>
              {goalsInput(`Nos buts, rencontre ${index + 1}`, draft.goalsFor, (value) => change(draft.id, { goalsFor: value }))}
            </label>
            <span aria-hidden="true">–</span>
            <label>
              <span>Adversaire</span>
              {goalsInput(`Buts adverses, rencontre ${index + 1}`, draft.goalsAgainst, (value) => change(draft.id, { goalsAgainst: value }))}
            </label>
          </div>
          {players.length > 0 && (
            <table className="match-result-players">
              <thead>
                <tr>
                  <th scope="col">Joueur</th>
                  <th scope="col">Buts</th>
                  <th scope="col">Passes</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <tr key={player.id}>
                    <th scope="row">{player.name}</th>
                    {(["goals", "assists"] as const).map((field) => (
                      <td key={field}>
                        {goalsInput(
                          `${field === "goals" ? "Buts" : "Passes décisives"} de ${player.name}, rencontre ${index + 1}`,
                          draft.stats.get(player.id)?.[field] ?? 0,
                          (value) => changeStat(draft.id, player.id, field, value),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
      <button className="match-details-save" disabled={drafts.length >= competitionGamesMax} onClick={add} type="button">
        + Ajouter une rencontre
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {feedback && <p className="match-convocation-feedback">{feedback}</p>}
      <button className="match-convocation-send" disabled={saving} onClick={() => void save()} type="button">
        {saving ? "Enregistrement…" : "Enregistrer les rencontres"}
      </button>
    </div>
  );
}
