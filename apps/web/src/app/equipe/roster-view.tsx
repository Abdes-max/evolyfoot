"use client";

import { playerPositionCodes, playerPositions } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { SidebarNav } from "../sidebar-nav";

interface RosterPlayer {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  photo?: string | null;
  position?: string | null;
  jerseyNumber?: string | null;
}

// Groupes de la liste, dans l’ordre du terrain ; « Sans poste » recueille les joueurs dont la fiche
// n’indique pas encore de poste.
const positionGroups: ReadonlyArray<{ key: string; label: string }> = [
  ...playerPositions.map((position) => ({ key: position, label: position })),
  { key: "", label: "Sans poste" },
];

function groupOf(player: RosterPlayer): string {
  return player.position && (playerPositions as readonly string[]).includes(player.position) ? player.position : "";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
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
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFirstName, setEditingFirstName] = useState("");
  const [editingLastName, setEditingLastName] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [positionFilter, setPositionFilter] = useState<string | null>(null);

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
    if (!newFirstName.trim() || !newLastName.trim()) {
      setAddError("Indique un prénom et un nom.");
      return;
    }

    setAdding(true);
    setAddError("");
    try {
      const response = await fetch("/api/roster", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName: newFirstName, lastName: newLastName }),
      });
      if (!response.ok) {
        setAddError(await readErrorMessage(response));
        return;
      }
      const body = await response.json();
      setPlayers((current) => [...current, body.player]);
      setNewFirstName("");
      setNewLastName("");
    } catch {
      setAddError("Une erreur est survenue.");
    } finally {
      setAdding(false);
    }
  }

  function startEditing(player: RosterPlayer) {
    setEditingId(player.id);
    setEditingFirstName(player.firstName);
    setEditingLastName(player.lastName);
    setRowError(null);
  }

  async function confirmRename(playerId: string) {
    if (!editingFirstName.trim() || !editingLastName.trim()) {
      setRowError({ id: playerId, message: "Indique un prénom et un nom." });
      return;
    }

    try {
      const response = await fetch(`/api/roster/${playerId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName: editingFirstName, lastName: editingLastName }),
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
    <>
      <SidebarNav />
      <main className="roster-shell">
        <header className="page-header roster-header">
          <div>
            <span className="eyebrow light">MON ÉQUIPE</span>
            <h1 title="Ton équipe.">Ton équipe.</h1>
            <p title="Tes joueurs par poste, avec leur numéro.">Tes joueurs par poste, avec leur numéro.</p>
          </div>
        </header>

        {authenticated === false && (
          <section className="roster-auth-required" role="status">
            <p>
              Connecte-toi pour gérer l’effectif de ton équipe.{" "}
              <Link className="inline-cta" href="/connexion">
                Se connecter →
              </Link>
            </p>
          </section>
        )}

        {authenticated && (
          <section className="roster-content roster-layout">
            <aside className="roster-side">
              <div className="roster-team-card">
                <span aria-hidden="true" className="roster-crest">
                  {initials(team?.name ?? "Équipe")}
                </span>
                <div>
                  <h2>{team?.name ?? "Mon équipe"}</h2>
                  {team ? (
                    <p className="roster-team-summary">
                      {team.ageGroup} · Foot à {team.gameFormat} · {players.length} joueur{players.length > 1 ? "s" : ""} au total
                    </p>
                  ) : (
                    <p className="roster-no-team">
                      Configure d’abord ton équipe.{" "}
                      <Link className="inline-cta" href="/onboarding">
                        Configurer mon équipe →
                      </Link>
                    </p>
                  )}
                </div>
              </div>

              <span className="roster-side-title">OUTILS</span>
              <form className="roster-add-form" onSubmit={addPlayer}>
                <label htmlFor="roster-new-player-first-name">Ajouter un joueur</label>
                <div className="roster-add-row">
                  <input
                    id="roster-new-player-first-name"
                    onChange={(event) => setNewFirstName(event.target.value)}
                    placeholder="Prénom"
                    value={newFirstName}
                  />
                  <input aria-label="Nom" onChange={(event) => setNewLastName(event.target.value)} placeholder="Nom" value={newLastName} />
                  <button disabled={adding} type="submit">
                    {adding ? "Ajout…" : "Ajouter"}
                  </button>
                </div>
                {addError && <small className="field-error">{addError}</small>}
              </form>
              <nav aria-label="Outils de l’équipe" className="roster-tools">
                <Link href="/onboarding">
                  Modifier l’équipe <span aria-hidden="true">›</span>
                </Link>
                <Link href="/profil#staff-title">
                  Staff et invitations <span aria-hidden="true">›</span>
                </Link>
                <Link href="/statistiques">
                  Statistiques de l’équipe <span aria-hidden="true">›</span>
                </Link>
                <Link href="/messagerie">
                  Messagerie <span aria-hidden="true">›</span>
                </Link>
              </nav>
            </aside>

            <div className="roster-main">
              <h2 className="roster-main-title">Tes joueurs ({players.length})</h2>
              <div aria-label="Filtrer par poste" className="roster-filters" role="group">
                {playerPositions.map((position) => (
                  <button
                    aria-pressed={positionFilter === position}
                    className={positionFilter === position ? "roster-filter active" : "roster-filter"}
                    key={position}
                    onClick={() => setPositionFilter((current) => (current === position ? null : position))}
                    type="button"
                  >
                    {position}
                  </button>
                ))}
              </div>

              {players.length === 0 && <p className="roster-empty">Aucun joueur pour l’instant.</p>}
              {positionGroups
                .filter((group) => positionFilter === null || group.key === positionFilter)
                .map((group) => {
                  const members = players
                    .filter((player) => groupOf(player) === group.key)
                    .sort((a, b) => (Number(a.jerseyNumber) || 99) - (Number(b.jerseyNumber) || 99) || a.name.localeCompare(b.name, "fr"));
                  if (members.length === 0) return null;
                  return (
                    <section aria-label={group.label} className="roster-group" key={group.key || "none"}>
                      <h3>{group.label}</h3>
                      <ul aria-label={`Effectif nominatif — ${group.label}`} className="roster-list">
                        {members.map((player) => (
                          <li className="roster-row" key={player.id}>
                            {editingId === player.id ? (
                              <>
                                <input
                                  aria-label={`Prénom de ${player.name}`}
                                  onChange={(event) => setEditingFirstName(event.target.value)}
                                  value={editingFirstName}
                                />
                                <input
                                  aria-label={`Nom de ${player.name}`}
                                  onChange={(event) => setEditingLastName(event.target.value)}
                                  value={editingLastName}
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
                                <Link className="roster-row-name" href={`/equipe/${player.id}`}>
                                  <span aria-hidden="true" className="roster-avatar">
                                    {player.photo ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img alt="" src={player.photo} />
                                    ) : (
                                      initials(player.name)
                                    )}
                                  </span>
                                  <span className="roster-row-identity">
                                    <strong>{player.name}</strong>
                                    <small>
                                      {group.key
                                        ? `${group.key} (${playerPositionCodes[group.key as keyof typeof playerPositionCodes]})`
                                        : "Poste à renseigner"}
                                    </small>
                                  </span>
                                  <span aria-hidden="true" className="roster-jersey">
                                    {player.jerseyNumber || "–"}
                                  </span>
                                </Link>
                                <div className="roster-row-actions">
                                  <button aria-label={`Renommer ${player.name}`} onClick={() => startEditing(player)} title="Renommer" type="button">
                                    ✎
                                  </button>
                                  <button aria-label={`Retirer ${player.name}`} onClick={() => removePlayer(player.id)} title="Retirer" type="button">
                                    ✕
                                  </button>
                                </div>
                              </>
                            )}
                            {rowError?.id === player.id && <small className="field-error">{rowError.message}</small>}
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
