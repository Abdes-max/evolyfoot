"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

interface RosterPlayer {
  id: string;
  name: string;
}

interface TeamSummary {
  name: string;
  ageGroup: string;
  gameFormat: number;
  playerCount: number;
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : "Une erreur est survenue.";
}

export function RosterView() {
  const [authenticated, setAuthenticated] = useState<boolean | undefined>(undefined);
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled) {
          return;
        }
        const isAuthenticated = Boolean(sessionBody.educator);
        setAuthenticated(isAuthenticated);
        if (!isAuthenticated) {
          return;
        }

        const [teamResponse, rosterResponse] = await Promise.all([fetch("/api/team"), fetch("/api/roster")]);
        const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
        const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
        if (cancelled) {
          return;
        }
        setTeam(teamBody.profile ?? null);
        setPlayers(rosterBody.players ?? []);
      } catch {
        if (!cancelled) {
          setAuthenticated(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function addPlayer(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) {
      setAddError("Indique un prénom.");
      return;
    }

    setAdding(true);
    setAddError("");
    try {
      const response = await fetch("/api/roster", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!response.ok) {
        setAddError(await readErrorMessage(response));
        return;
      }
      const body = await response.json();
      setPlayers((current) => [...current, body.player]);
      setNewName("");
    } catch {
      setAddError("Une erreur est survenue.");
    } finally {
      setAdding(false);
    }
  }

  function startEditing(player: RosterPlayer) {
    setEditingId(player.id);
    setEditingName(player.name);
    setRowError(null);
  }

  async function confirmRename(playerId: string) {
    if (!editingName.trim()) {
      setRowError({ id: playerId, message: "Indique un prénom." });
      return;
    }

    try {
      const response = await fetch(`/api/roster/${playerId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: editingName }),
      });
      if (!response.ok) {
        setRowError({ id: playerId, message: await readErrorMessage(response) });
        return;
      }
      const body = await response.json();
      setPlayers((current) => current.map((player) => (player.id === playerId ? body.player : player)));
      setEditingId(null);
    } catch {
      setRowError({ id: playerId, message: "Une erreur est survenue." });
    }
  }

  async function removePlayer(playerId: string) {
    try {
      const response = await fetch(`/api/roster/${playerId}`, { method: "DELETE" });
      if (!response.ok) {
        setRowError({ id: playerId, message: await readErrorMessage(response) });
        return;
      }
      setPlayers((current) => current.filter((player) => player.id !== playerId));
    } catch {
      setRowError({ id: playerId, message: "Une erreur est survenue." });
    }
  }

  return (
    <main className="roster-shell">
      <header className="roster-header">
        <Link className="onboarding-brand" href="/">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <span className="eyebrow light">MON ÉQUIPE</span>
        <h1>L’effectif nominatif.</h1>
        <p>Ajoute, renomme ou retire un joueur à tout moment — utile pour tes observations.</p>
        {team && (
          <p className="roster-team-summary">
            {team.name} · {team.ageGroup} · Foot à {team.gameFormat} · {team.playerCount} joueurs au total ·{" "}
            <Link href="/onboarding">Modifier mon équipe →</Link>
          </p>
        )}
      </header>

      {authenticated === false && (
        <section className="roster-auth-required" role="status">
          <p>
            Connecte-toi pour gérer l’effectif de ton équipe. <Link href="/connexion">Se connecter →</Link>
          </p>
        </section>
      )}

      {authenticated && (
        <section className="roster-content">
          {!team && (
            <p className="roster-no-team">
              Configure d’abord ton équipe. <Link href="/onboarding">Configurer mon équipe →</Link>
            </p>
          )}

          <form className="roster-add-form" onSubmit={addPlayer}>
            <label htmlFor="roster-new-player-name">Ajouter un joueur</label>
            <div className="roster-add-row">
              <input
                id="roster-new-player-name"
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Prénom"
                value={newName}
              />
              <button disabled={adding} type="submit">
                {adding ? "Ajout…" : "Ajouter"}
              </button>
            </div>
            {addError && <small className="field-error">{addError}</small>}
          </form>

          <ul className="roster-list" aria-label="Effectif nominatif">
            {players.map((player) => (
              <li className="roster-row" key={player.id}>
                {editingId === player.id ? (
                  <>
                    <input
                      aria-label={`Renommer ${player.name}`}
                      onChange={(event) => setEditingName(event.target.value)}
                      value={editingName}
                    />
                    <div className="roster-row-actions">
                      <button onClick={() => confirmRename(player.id)} type="button">
                        Enregistrer
                      </button>
                      <button onClick={() => setEditingId(null)} type="button">
                        Annuler
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>{player.name}</strong>
                    <div className="roster-row-actions">
                      <button aria-label={`Renommer ${player.name}`} onClick={() => startEditing(player)} type="button">
                        Renommer
                      </button>
                      <button aria-label={`Retirer ${player.name}`} onClick={() => removePlayer(player.id)} type="button">
                        Retirer
                      </button>
                    </div>
                  </>
                )}
                {rowError?.id === player.id && <small className="field-error">{rowError.message}</small>}
              </li>
            ))}
            {players.length === 0 && <p className="roster-empty">Aucun joueur pour l’instant.</p>}
          </ul>

          <Link className="back-link" href="/">
            Retour au tableau de bord
          </Link>
        </section>
      )}
    </main>
  );
}
