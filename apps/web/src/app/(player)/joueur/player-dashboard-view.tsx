"use client";

import {
  attendanceStatusLabels,
  playerEvaluationAspectLabels,
  playerEvaluationAspects,
  playerEvaluationMaxScore,
  playerEvaluationMinScore,
  type AttendanceStatus,
  type PlayerEvaluationScores,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DonutChart, RadarChart } from "../../charts";
import { colorForEvaluation } from "../../evaluation-colors";
import { BallIcon, TargetIcon } from "../../icons";
import { currentCycleWeek } from "../../session/cycle";
import { todayWeekDayFull } from "../../today";

const weekDays: ReadonlyArray<{ short: string; full: string }> = [
  { short: "LUN.", full: "Lundi" },
  { short: "MAR.", full: "Mardi" },
  { short: "MER.", full: "Mercredi" },
  { short: "JEU.", full: "Jeudi" },
  { short: "VEN.", full: "Vendredi" },
  { short: "SAM.", full: "Samedi" },
  { short: "DIM.", full: "Dimanche" },
];

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
  myStatus: AttendanceStatus | null;
}

interface Competition {
  id: string;
  type: "plateau" | "tournoi";
  name: string;
  dateLabel: string;
}

interface Dashboard {
  player: { id: string; name: string; photo: string | null };
  team: { name: string; ageGroup: string; trainingDays: string[] } | null;
  evaluations: Evaluation[];
  trainingAttendance: { present: number; absent: number; total: number; rate: number };
  matchAttendance: { present: number; absent: number; total: number; rate: number };
  upcomingMatches: DashboardMatch[];
  trainingSlots: { weekNumber: number; slot: number }[];
  competitions: Competition[];
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

// Même grille que le calendrier du coach (apps/web/weekly-calendar.tsx), en lecture seule : pas
// de lien vers une séance ou un match, le joueur/tuteur n'y a de toute façon pas accès -- juste de
// quoi voir d'un coup d'œil ce qui se passe cette semaine.
function WeekCalendar({ dashboard }: { dashboard: Dashboard }) {
  const trainingDays = dashboard.team?.trainingDays ?? [];
  const activeWeek = currentCycleWeek(dashboard.trainingSlots, Math.max(trainingDays.length, 1));

  const trainingByDay = new Map<string, boolean>();
  let slot = 0;
  for (const day of weekDays) {
    if (trainingDays.includes(day.full)) {
      const generated = dashboard.trainingSlots.some((entry) => entry.weekNumber === activeWeek && entry.slot === slot);
      trainingByDay.set(day.full, generated);
      slot += 1;
    }
  }

  // `dateLabel` est un texte libre ("Samedi 26 septembre · 14:00 · Domicile") : on repère juste le
  // jour en tête, comme côté coach -- un calendrier indicatif, pas une source de vérité.
  const matchByDay = new Map<string, DashboardMatch>();
  for (const match of dashboard.upcomingMatches) {
    const day = weekDays.find((candidate) => match.dateLabel.startsWith(candidate.full));
    if (day && !matchByDay.has(day.full)) {
      matchByDay.set(day.full, match);
    }
  }

  return (
    <div className="week-card week-calendar">
      <div className="week-calendar-grid">
        {weekDays.map((day) => {
          const hasTraining = trainingByDay.has(day.full);
          const match = matchByDay.get(day.full);
          const isToday = day.full === todayWeekDayFull();
          return (
            <div className={isToday ? "week-calendar-day today" : "week-calendar-day"} key={day.full}>
              <span className="week-calendar-day-label">{day.short}</span>
              <div className="week-calendar-cell">
                {hasTraining && (
                  <span className="week-calendar-badge training" title="Séance d’entraînement">
                    <TargetIcon />
                  </span>
                )}
                {match && (
                  <Link
                    aria-label={`Voir le détail du match contre ${match.opponent}`}
                    className="week-calendar-badge match"
                    href={`/joueur/matches/${match.id}`}
                    title={`Match contre ${match.opponent}`}
                  >
                    <BallIcon />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ul className="week-calendar-legend">
        <li>
          <span className="week-calendar-badge training">
            <TargetIcon />
          </span>
          Séance d’entraînement
        </li>
        <li>
          <span className="week-calendar-badge match">
            <BallIcon />
          </span>
          Match / compétition
        </li>
      </ul>
    </div>
  );
}

export function PlayerSpaceView() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  // Évaluations superposées sur le radar -- même mécanisme que côté coach (player-detail-view.tsx),
  // en lecture seule ici : pas d'ajout/modification/retrait, juste comparer.
  const [comparedEvaluationIds, setComparedEvaluationIds] = useState<ReadonlySet<string>>(new Set());

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
          setComparedEvaluationIds(body.dashboard.evaluations[0] ? new Set([body.dashboard.evaluations[0].id]) : new Set());
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

  function toggleCompare(evaluationId: string) {
    setComparedEvaluationIds((current) => {
      const next = new Set(current);
      if (next.has(evaluationId)) {
        next.delete(evaluationId);
      } else {
        next.add(evaluationId);
      }
      return next;
    });
  }

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
                    size={300}
                    series={
                      comparedEvaluationIds.size > 0
                        ? dashboard.evaluations
                            .filter((evaluation) => comparedEvaluationIds.has(evaluation.id))
                            .map((evaluation) => ({
                              key: evaluation.id,
                              label: formatDate(evaluation.createdAt),
                              color: colorForEvaluation(evaluation.id, dashboard.evaluations),
                              scores: evaluation.scores,
                            }))
                        : undefined
                    }
                    scores={comparedEvaluationIds.size === 0 ? latest.scores : undefined}
                  />
                  <div>
                    {comparedEvaluationIds.size === 0 && (
                      <p className="player-space-caption">Dernière évaluation · {formatDate(latest.createdAt)}</p>
                    )}
                    {dashboard.evaluations.length > 1 && (
                      <ul className="player-space-history">
                        {dashboard.evaluations.map((evaluation) => {
                          const total = playerEvaluationAspects.reduce((sum, aspect) => sum + evaluation.scores[aspect], 0);
                          const average = Math.round((total / playerEvaluationAspects.length) * 10) / 10;
                          const compared = comparedEvaluationIds.has(evaluation.id);
                          return (
                            <li key={evaluation.id}>
                              <label className="player-evaluation-compare">
                                <input checked={compared} onChange={() => toggleCompare(evaluation.id)} type="checkbox" />
                                <span
                                  aria-hidden="true"
                                  className="radar-chart-legend-dot"
                                  style={{ background: compared ? colorForEvaluation(evaluation.id, dashboard.evaluations) : "transparent" }}
                                />
                              </label>
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
                <h2>Calendrier de la semaine</h2>
                <WeekCalendar dashboard={dashboard} />
              </section>
            )}

            <section className="player-space-block">
              <h2>Mes convocations</h2>
              {dashboard.upcomingMatches.length === 0 ? (
                <p className="player-space-empty">Aucun match à venir.</p>
              ) : (
                <ul className="player-space-matches">
                  {dashboard.upcomingMatches.map((match) => (
                    <li key={match.id}>
                      <Link className={match.convoked ? "player-space-match-link convoked" : "player-space-match-link"} href={`/joueur/matches/${match.id}`}>
                        <strong>{match.opponent}</strong>
                        <span>
                          {match.dateLabel} · {venueLabel[match.venue]}
                        </span>
                        <span className="player-space-tag">
                          {match.myStatus
                            ? `Réponse : ${attendanceStatusLabels[match.myStatus]}`
                            : match.convoked
                              ? "Convoqué"
                              : "Pas encore dans le groupe"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="player-space-block">
              <h2>Compétitions</h2>
              {dashboard.competitions.length === 0 ? (
                <p className="player-space-empty">Aucune compétition enregistrée.</p>
              ) : (
                <ul className="player-space-matches">
                  {dashboard.competitions.map((competition) => (
                    <li key={competition.id}>
                      <strong>{competition.name}</strong>
                      <span>{competition.dateLabel}</span>
                      <span className="player-space-tag">{competition.type === "plateau" ? "Plateau" : "Tournoi"}</span>
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
