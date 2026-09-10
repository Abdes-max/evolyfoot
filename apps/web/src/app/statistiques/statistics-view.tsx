"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { BarChart, DonutChart } from "../charts";

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

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : "Une erreur est survenue.";
}

export function StatisticsView() {
  const [authenticated, setAuthenticated] = useState<boolean | undefined>(undefined);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const [tournamentName, setTournamentName] = useState("");
  const [tournamentDate, setTournamentDate] = useState("");
  const [tournamentResult, setTournamentResult] = useState("");
  const [tournamentError, setTournamentError] = useState("");
  const [addingTournament, setAddingTournament] = useState(false);

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

        const [statsResponse, tournamentsResponse] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/tournaments"),
        ]);
        const statsBody = await statsResponse.json().catch(() => ({ stats: null }));
        const tournamentsBody = await tournamentsResponse.json().catch(() => ({ tournaments: [] }));
        if (cancelled) {
          return;
        }

        setStats(statsBody.stats ?? null);
        setTournaments(tournamentsBody.tournaments ?? []);
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

          <p className="statistics-hint">
            L’évaluation individuelle des joueurs (toile d’araignée) est sur chaque <Link className="inline-cta" href="/equipe">fiche joueur</Link>.
          </p>

          <Link className="back-link" href="/">
            Retour au tableau de bord
          </Link>
        </section>
      )}
    </main>
  );
}
