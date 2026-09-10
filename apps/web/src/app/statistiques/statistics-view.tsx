"use client";

import {
  playerEvaluationAspectLabels,
  playerEvaluationAspects,
  playerEvaluationMaxScore,
  playerEvaluationMinScore,
  type PlayerEvaluationAspect,
  type PlayerEvaluationScores,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { BarChart, DonutChart, RadarChart } from "../charts";

interface TeamStats {
  trainingCount: number;
  matchCount: number;
  matchesPlayed: number;
  matchesScheduled: number;
  tournamentCount: number;
  trainingAttendance: { present: number; absent: number; total: number; rate: number };
  matchAttendance: { present: number; absent: number; total: number; rate: number };
}

interface Tournament {
  id: string;
  name: string;
  dateLabel: string;
  result: string | null;
}

interface RosterPlayer {
  id: string;
  name: string;
}

interface PlayerEvaluation {
  playerId: string;
  scores: PlayerEvaluationScores;
}

const radarAxes = playerEvaluationAspects.map((aspect) => ({ key: aspect, label: playerEvaluationAspectLabels[aspect] }));

function midpointScores(): PlayerEvaluationScores {
  const midpoint = Math.round((playerEvaluationMinScore + playerEvaluationMaxScore) / 2);
  return Object.fromEntries(playerEvaluationAspects.map((aspect) => [aspect, midpoint])) as PlayerEvaluationScores;
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : "Une erreur est survenue.";
}

export function StatisticsView() {
  const [authenticated, setAuthenticated] = useState<boolean | undefined>(undefined);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, PlayerEvaluationScores>>({});
  const [selectedPlayerId, setSelectedPlayerId] = useState("");

  const [tournamentName, setTournamentName] = useState("");
  const [tournamentDate, setTournamentDate] = useState("");
  const [tournamentResult, setTournamentResult] = useState("");
  const [tournamentError, setTournamentError] = useState("");
  const [addingTournament, setAddingTournament] = useState(false);

  const [savingEvaluation, setSavingEvaluation] = useState(false);
  const [evaluationSaved, setEvaluationSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled || !sessionBody.educator) {
          setAuthenticated(Boolean(sessionBody.educator));
          return;
        }
        setAuthenticated(true);

        const [statsResponse, tournamentsResponse, rosterResponse, evaluationsResponse] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/tournaments"),
          fetch("/api/roster"),
          fetch("/api/player-evaluations"),
        ]);
        const statsBody = await statsResponse.json().catch(() => ({ stats: null }));
        const tournamentsBody = await tournamentsResponse.json().catch(() => ({ tournaments: [] }));
        const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
        const evaluationsBody = await evaluationsResponse.json().catch(() => ({ evaluations: [] }));
        if (cancelled) {
          return;
        }

        setStats(statsBody.stats ?? null);
        setTournaments(tournamentsBody.tournaments ?? []);
        const roster: RosterPlayer[] = rosterBody.players ?? [];
        setPlayers(roster);
        const byPlayer: Record<string, PlayerEvaluationScores> = {};
        for (const evaluation of (evaluationsBody.evaluations ?? []) as PlayerEvaluation[]) {
          byPlayer[evaluation.playerId] = evaluation.scores;
        }
        setEvaluations(byPlayer);
        if (roster.length > 0) {
          setSelectedPlayerId(roster[0]!.id);
        }
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

  async function addTournament(event: FormEvent) {
    event.preventDefault();
    setAddingTournament(true);
    setTournamentError("");
    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: tournamentName, dateLabel: tournamentDate, result: tournamentResult || undefined }),
      });
      if (!response.ok) {
        setTournamentError(await readErrorMessage(response));
        return;
      }
      const body = await response.json();
      setTournaments((current) => [body.tournament, ...current]);
      setTournamentName("");
      setTournamentDate("");
      setTournamentResult("");
    } catch {
      setTournamentError("Une erreur est survenue.");
    } finally {
      setAddingTournament(false);
    }
  }

  async function removeTournament(tournamentId: string) {
    setTournaments((current) => current.filter((tournament) => tournament.id !== tournamentId));
    try {
      await fetch(`/api/tournaments/${tournamentId}`, { method: "DELETE" });
    } catch {
      // Rien à faire de plus : une fiche simple, sans conséquence si la suppression réseau
      // échoue silencieusement -- la page reflète déjà l'intention de l'éducateur.
    }
  }

  function updateScore(aspect: PlayerEvaluationAspect, value: number) {
    if (!selectedPlayerId) {
      return;
    }
    setEvaluationSaved(false);
    setEvaluations((current) => ({
      ...current,
      [selectedPlayerId]: { ...(current[selectedPlayerId] ?? midpointScores()), [aspect]: value },
    }));
  }

  async function saveEvaluation() {
    if (!selectedPlayerId) {
      return;
    }
    setSavingEvaluation(true);
    setEvaluationSaved(false);
    try {
      const scores = evaluations[selectedPlayerId] ?? midpointScores();
      const response = await fetch(`/api/player-evaluations/${selectedPlayerId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scores }),
      });
      if (response.ok) {
        setEvaluationSaved(true);
      }
    } finally {
      setSavingEvaluation(false);
    }
  }

  if (authenticated === false) {
    return (
      <main className="statistics-shell">
        <section className="statistics-auth-required" role="status">
          <p>
            Connecte-toi pour voir les statistiques de ton équipe. <Link className="inline-cta" href="/connexion">Se connecter →</Link>
          </p>
        </section>
      </main>
    );
  }

  const selectedScores = selectedPlayerId ? (evaluations[selectedPlayerId] ?? midpointScores()) : midpointScores();

  return (
    <main className="statistics-shell">
      <header className="page-header statistics-header">
        <Link className="onboarding-brand" href="/">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <div>
          <span className="eyebrow light">STATISTIQUES</span>
          <h1 title="Le suivi de ta saison.">Le suivi de ta saison.</h1>
          <p title="Présences, activité et évaluation individuelle des joueurs.">Présences, activité et évaluation individuelle des joueurs.</p>
        </div>
      </header>

      {authenticated && stats && (
        <section className="statistics-content">
          <div className="statistics-block">
            <h2>Activité de la saison</h2>
            <BarChart
              data={[
                { label: "Séances", value: stats.trainingCount },
                { label: "Matchs", value: stats.matchCount },
                { label: "Tournois", value: stats.tournamentCount },
              ]}
            />
            <p className="statistics-hint">
              {stats.matchesPlayed} match{stats.matchesPlayed > 1 ? "s" : ""} joué{stats.matchesPlayed > 1 ? "s" : ""} · {stats.matchesScheduled} à venir
            </p>
          </div>

          <div className="statistics-attendance-grid">
            <div className="statistics-block">
              <h2>Présence aux séances</h2>
              {stats.trainingAttendance.total > 0 ? (
                <DonutChart
                  centerLabel="présence"
                  centerValue={`${stats.trainingAttendance.rate}%`}
                  segments={[
                    { label: "Présents", value: stats.trainingAttendance.present, tone: "good" },
                    { label: "Absents", value: stats.trainingAttendance.absent, tone: "warn" },
                  ]}
                />
              ) : (
                <p className="statistics-empty">Aucune présence saisie pour l’instant.</p>
              )}
            </div>
            <div className="statistics-block">
              <h2>Présence aux matchs</h2>
              {stats.matchAttendance.total > 0 ? (
                <DonutChart
                  centerLabel="présence"
                  centerValue={`${stats.matchAttendance.rate}%`}
                  segments={[
                    { label: "Présents", value: stats.matchAttendance.present, tone: "good" },
                    { label: "Absents", value: stats.matchAttendance.absent, tone: "warn" },
                  ]}
                />
              ) : (
                <p className="statistics-empty">Aucune présence saisie pour l’instant.</p>
              )}
            </div>
          </div>

          <div className="statistics-block">
            <h2>Tournois</h2>
            <form className="statistics-tournament-form" onSubmit={addTournament}>
              <input onChange={(event) => setTournamentName(event.target.value)} placeholder="Nom du tournoi" value={tournamentName} />
              <input onChange={(event) => setTournamentDate(event.target.value)} placeholder="Date" value={tournamentDate} />
              <input onChange={(event) => setTournamentResult(event.target.value)} placeholder="Bilan (optionnel)" value={tournamentResult} />
              <button disabled={addingTournament} type="submit">
                {addingTournament ? "Ajout…" : "Ajouter"}
              </button>
            </form>
            {tournamentError && <p className="field-error" role="alert">{tournamentError}</p>}
            {tournaments.length === 0 ? (
              <p className="statistics-empty">Aucun tournoi pour l’instant.</p>
            ) : (
              <ul className="statistics-tournament-list">
                {tournaments.map((tournament) => (
                  <li key={tournament.id}>
                    <div>
                      <strong>{tournament.name}</strong>
                      <span>{tournament.dateLabel}{tournament.result ? ` · ${tournament.result}` : ""}</span>
                    </div>
                    <button aria-label={`Retirer ${tournament.name}`} onClick={() => removeTournament(tournament.id)} type="button">
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="statistics-block">
            <h2>Évaluation d’un joueur</h2>
            {players.length === 0 ? (
              <p className="statistics-empty">
                Ajoute des joueurs à ton effectif pour pouvoir les évaluer. <Link className="inline-cta" href="/equipe">Gérer mon équipe →</Link>
              </p>
            ) : (
              <div className="statistics-evaluation">
                <div className="statistics-evaluation-form">
                  <label htmlFor="statistics-player-select">Joueur</label>
                  <select
                    id="statistics-player-select"
                    onChange={(event) => {
                      setSelectedPlayerId(event.target.value);
                      setEvaluationSaved(false);
                    }}
                    value={selectedPlayerId}
                  >
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                  {playerEvaluationAspects.map((aspect) => (
                    <div className="statistics-evaluation-row" key={aspect}>
                      <span>{playerEvaluationAspectLabels[aspect]}</span>
                      <input
                        aria-label={playerEvaluationAspectLabels[aspect]}
                        max={playerEvaluationMaxScore}
                        min={playerEvaluationMinScore}
                        onChange={(event) => updateScore(aspect, Number(event.target.value))}
                        type="range"
                        value={selectedScores[aspect]}
                      />
                      <strong>{selectedScores[aspect]}</strong>
                    </div>
                  ))}
                  <button disabled={savingEvaluation} onClick={saveEvaluation} type="button">
                    {savingEvaluation ? "Enregistrement…" : "Enregistrer l’évaluation"}
                  </button>
                  {evaluationSaved && <p className="statistics-saved" role="status">Évaluation enregistrée.</p>}
                </div>
                <RadarChart axes={radarAxes} max={playerEvaluationMaxScore} min={playerEvaluationMinScore} scores={selectedScores} />
              </div>
            )}
          </div>

          <Link className="back-link" href="/">
            Retour au tableau de bord
          </Link>
        </section>
      )}
    </main>
  );
}
