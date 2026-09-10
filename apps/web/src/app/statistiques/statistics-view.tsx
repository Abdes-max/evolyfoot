"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart, DonutChart } from "../charts";

interface TeamStats {
  trainingCount: number;
  matchCount: number;
  matchesPlayed: number;
  matchesScheduled: number;
  tournamentCount: number;
  plateauCount: number;
  trainingAttendance: { present: number; absent: number; total: number; rate: number };
  matchAttendance: { present: number; absent: number; total: number; rate: number };
}

function plural(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`;
}

// Rapport = synthèse purement factuelle des chiffres ci-dessus, pas d'analyse « intelligente ».
function buildReport(stats: TeamStats): string[] {
  const lines: string[] = [];
  lines.push(
    `Depuis le début de la saison : ${plural(stats.trainingCount, "séance")} et ${plural(
      stats.matchCount,
      "match",
      "matchs",
    )} (${plural(stats.matchesPlayed, "joué", "joués")}, ${stats.matchesScheduled} à venir).`,
  );
  if (stats.tournamentCount > 0 || stats.plateauCount > 0) {
    lines.push(`${plural(stats.tournamentCount, "tournoi")} et ${plural(stats.plateauCount, "plateau", "plateaux")}.`);
  }
  if (stats.trainingAttendance.total > 0) {
    lines.push(
      `Présence moyenne à l’entraînement : ${stats.trainingAttendance.rate}% (${stats.trainingAttendance.present} présences sur ${stats.trainingAttendance.total} relevées).`,
    );
  } else {
    lines.push("Aucune présence n’a encore été relevée à l’entraînement (elle se saisit à la préparation d’une séance).");
  }
  if (stats.matchAttendance.total > 0) {
    lines.push(`Présence moyenne en match : ${stats.matchAttendance.rate}%.`);
  }
  return lines;
}

export function StatisticsView() {
  const [authenticated, setAuthenticated] = useState<boolean | undefined>(undefined);
  const [stats, setStats] = useState<TeamStats | null>(null);

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

        const statsResponse = await fetch("/api/stats");
        const statsBody = await statsResponse.json().catch(() => ({ stats: null }));
        if (!cancelled) {
          setStats(statsBody.stats ?? null);
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

  if (authenticated === false) {
    return (
      <main className="statistics-shell">
        <section className="statistics-auth-required" role="status">
          <p>
            Connecte-toi pour voir les statistiques de ton équipe.{" "}
            <Link className="inline-cta" href="/connexion">
              Se connecter →
            </Link>
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
          <p title="Les chiffres de la saison, en diagrammes et en une synthèse.">
            Les chiffres de la saison, en diagrammes et en une synthèse.
          </p>
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
                { label: "Plateaux", value: stats.plateauCount },
              ]}
            />
            <p className="statistics-hint">
              {plural(stats.matchesPlayed, "match joué", "matchs joués")} · {stats.matchesScheduled} à venir
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
            <h2>Rapport</h2>
            <ul className="statistics-report">
              {buildReport(stats).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="statistics-hint">
              Tournois et plateaux se gèrent depuis <Link className="inline-cta" href="/match">Matchs &amp; compétitions</Link> ·
              l’évaluation individuelle est sur chaque <Link className="inline-cta" href="/equipe">fiche joueur</Link>.
            </p>
          </div>

          <Link className="back-link" href="/">
            Retour au tableau de bord
          </Link>
        </section>
      )}
    </main>
  );
}
