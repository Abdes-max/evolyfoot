"use client";

import {
  playerEvaluationAspectLabels,
  playerEvaluationAspects,
  playerEvaluationMaxScore,
  playerEvaluationMinScore,
  type PlayerEvaluationScores,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DonutChart, RadarChart } from "../../charts";

interface Evaluation {
  id: string;
  scores: PlayerEvaluationScores;
  createdAt: string;
}

interface DashboardMatch {
  id: string;
  opponent: string;
  dateLabel: string;
  venue: "home" | "away";
  convoked: boolean;
}

interface Dashboard {
  player: { id: string; name: string; photo: string | null };
  team: { name: string; ageGroup: string; trainingDays: string[] } | null;
  evaluations: Evaluation[];
  trainingAttendance: { present: number; absent: number; total: number; rate: number };
  matchAttendance: { present: number; absent: number; total: number; rate: number };
  upcomingMatches: DashboardMatch[];
}

const radarAxes = playerEvaluationAspects.map((aspect) => ({ key: aspect, label: playerEvaluationAspectLabels[aspect] }));
const venueLabel = { home: "Domicile", away: "Extérieur" } as const;

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? iso
    : parsed.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "/connexion";
  }
}

export function PlayerSpaceView() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/joueur");
        const body = await response.json().catch(() => ({ dashboard: null }));
        if (cancelled) {
          return;
        }
        if (response.ok && body.dashboard) {
          setDashboard(body.dashboard);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = dashboard?.evaluations[0];

  return (
    <div className="player-space">
      <header className="player-space-header">
        <Link className="onboarding-brand" href="/joueur">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <button className="player-space-logout" onClick={logout} type="button">
          Se déconnecter
        </button>
      </header>

      <main className="player-space-content">
        {status === "loading" && <p className="player-space-note">Chargement…</p>}
        {status === "error" && <p className="player-space-note">Impossible de charger ton suivi pour le moment.</p>}

        {status === "ready" && dashboard && (
          <>
            <section className="player-space-hero">
              <span className="player-space-avatar" aria-hidden="true">
                {dashboard.player.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={dashboard.player.photo} />
                ) : (
                  dashboard.player.name.trim().slice(0, 1).toUpperCase() || "?"
                )}
              </span>
              <div>
                <h1>{dashboard.player.name}</h1>
                {dashboard.team && (
                  <p>
                    {dashboard.team.name} · {dashboard.team.ageGroup}
                  </p>
                )}
              </div>
            </section>

            <section className="player-space-block">
              <h2>Ma progression</h2>
              {latest ? (
                <div className="player-space-progress">
                  <RadarChart
                    axes={radarAxes}
                    max={playerEvaluationMaxScore}
                    min={playerEvaluationMinScore}
                    scores={latest.scores}
                  />
                  <div>
                    <p className="player-space-caption">Dernière évaluation · {formatDate(latest.createdAt)}</p>
                    {dashboard.evaluations.length > 1 && (
                      <ul className="player-space-history">
                        {dashboard.evaluations.slice(1).map((evaluation) => {
                          const total = playerEvaluationAspects.reduce((sum, aspect) => sum + evaluation.scores[aspect], 0);
                          const average = Math.round((total / playerEvaluationAspects.length) * 10) / 10;
                          return (
                            <li key={evaluation.id}>
                              {formatDate(evaluation.createdAt)} · moyenne {average}/{playerEvaluationMaxScore}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <p className="player-space-empty">Aucune évaluation pour l’instant.</p>
              )}
            </section>

            <div className="player-space-grid">
              <section className="player-space-block">
                <h2>Ma présence aux séances</h2>
                {dashboard.trainingAttendance.total > 0 ? (
                  <DonutChart
                    centerLabel="présence"
                    centerValue={`${dashboard.trainingAttendance.rate}%`}
                    segments={[
                      { label: "Présent", value: dashboard.trainingAttendance.present, tone: "good" },
                      { label: "Absent", value: dashboard.trainingAttendance.absent, tone: "warn" },
                    ]}
                  />
                ) : (
                  <p className="player-space-empty">Aucune présence relevée.</p>
                )}
              </section>
              <section className="player-space-block">
                <h2>Ma présence aux matchs</h2>
                {dashboard.matchAttendance.total > 0 ? (
                  <DonutChart
                    centerLabel="présence"
                    centerValue={`${dashboard.matchAttendance.rate}%`}
                    segments={[
                      { label: "Présent", value: dashboard.matchAttendance.present, tone: "good" },
                      { label: "Absent", value: dashboard.matchAttendance.absent, tone: "warn" },
                    ]}
                  />
                ) : (
                  <p className="player-space-empty">Aucune présence relevée.</p>
                )}
              </section>
            </div>

            {dashboard.team && dashboard.team.trainingDays.length > 0 && (
              <section className="player-space-block">
                <h2>Cette semaine</h2>
                <p className="player-space-days">
                  Entraînement : {dashboard.team.trainingDays.join(", ")}.
                </p>
              </section>
            )}

            <section className="player-space-block">
              <h2>Mes convocations</h2>
              {dashboard.upcomingMatches.length === 0 ? (
                <p className="player-space-empty">Aucun match à venir.</p>
              ) : (
                <ul className="player-space-matches">
                  {dashboard.upcomingMatches.map((match) => (
                    <li className={match.convoked ? "convoked" : ""} key={match.id}>
                      <strong>{match.opponent}</strong>
                      <span>
                        {match.dateLabel} · {venueLabel[match.venue]}
                      </span>
                      <span className="player-space-tag">{match.convoked ? "Convoqué" : "Pas encore dans le groupe"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
