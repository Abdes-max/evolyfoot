"use client";

import { matchResultMaxGoals, type MatchPlayerStat } from "@evolyfoot/domain";
import { useState, type FormEvent } from "react";

interface MatchResultFormProps {
  matchId: string;
  // Joueurs de la feuille de match, titulaires et remplaçants.
  players: ReadonlyArray<{ id: string; name: string }>;
  goalsFor: number | null;
  goalsAgainst: number | null;
  playerStats: readonly MatchPlayerStat[];
}

type StatField = "goals" | "assists";

export function MatchResultForm({ matchId, players, goalsFor, goalsAgainst, playerStats }: MatchResultFormProps) {
  const [scoreFor, setScoreFor] = useState(goalsFor ?? 0);
  const [scoreAgainst, setScoreAgainst] = useState(goalsAgainst ?? 0);
  const [stats, setStats] = useState<ReadonlyMap<string, MatchPlayerStat>>(
    () => new Map(playerStats.map((stat) => [stat.playerId, stat])),
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  function updateStat(player: { id: string; name: string }, field: StatField, value: number) {
    setStatus("");
    setStats((current) => {
      const next = new Map(current);
      const stat = next.get(player.id) ?? { playerId: player.id, playerName: player.name, goals: 0, assists: 0 };
      next.set(player.id, { ...stat, [field]: value });
      return next;
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/matches/${matchId}/result`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goalsFor: scoreFor, goalsAgainst: scoreAgainst, playerStats: [...stats.values()] }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof body.error === "string" ? body.error : "L’enregistrement a échoué.");
        return;
      }
      setStatus("Résultat enregistré.");
    } catch {
      setError("L’enregistrement a échoué, réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="match-result-title" className="match-result">
      <h2 id="match-result-title">Résultat</h2>
      <form onSubmit={save}>
        <div className="match-result-score">
          <label>
            <span>Nous</span>
            <input
              max={matchResultMaxGoals}
              min={0}
              onChange={(event) => setScoreFor(Number(event.target.value))}
              type="number"
              value={scoreFor}
            />
          </label>
          <span aria-hidden="true">–</span>
          <label>
            <span>Adversaire</span>
            <input
              max={matchResultMaxGoals}
              min={0}
              onChange={(event) => setScoreAgainst(Number(event.target.value))}
              type="number"
              value={scoreAgainst}
            />
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
                      <input
                        aria-label={`${field === "goals" ? "Buts" : "Passes décisives"} de ${player.name}`}
                        max={matchResultMaxGoals}
                        min={0}
                        onChange={(event) => updateStat(player, field, Number(event.target.value))}
                        type="number"
                        value={stats.get(player.id)?.[field] ?? 0}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {status && <p role="status">{status}</p>}
        <button className="player-primary" disabled={saving} type="submit">
          {saving ? "Enregistrement…" : "Enregistrer le résultat"}
        </button>
      </form>
    </section>
  );
}
