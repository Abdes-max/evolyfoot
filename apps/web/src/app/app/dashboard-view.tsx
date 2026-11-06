"use client";

import {
  buildDevelopmentPlan,
  buildPrioritizedSeason,
  currentCycleWeek,
  diagnosticCriteria,
  firstFreeCycleSlot,
  formationSlots,
  guidedSeasonCycle,
  seasonWeekAt,
  summarizeDiagnostic,
  suggestAdjustmentFromObservation,
  trainingCycleWeekCount,
  type DiagnosticScores,
  type GameFormat,
  type MatchLineupAssignment,
  type ObservationReport,
  type SavedTrainingSession,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TodayDate } from "../today-date";
import { WeeklyCalendar } from "../weekly-calendar";

interface UpcomingMatch {
  id: string;
  opponent: string;
  dateLabel: string;
  date: string | null;
  venue: "home" | "away";
  location?: string | null;
  gameFormat: number;
  formationId: string;
  status: "scheduled" | "played";
  lineup: readonly MatchLineupAssignment[];
  captainPlayerId: string | null;
}

interface SeasonProgram {
  priorities: string[];
  startDate: string;
}

interface DashboardData {
  displayName: string;
  hasTeam: boolean;
  teamName: string | null;
  sessionsPerWeek: number;
  matches: readonly UpcomingMatch[];
  seasonProgram: SeasonProgram | null;
  seasonPreparedCount: number;
  trainingDayCount: number;
  scores: DiagnosticScores | null;
  sessions: readonly SavedTrainingSession[];
  observations: readonly ObservationReport[];
}

const levelByScore: Readonly<Record<number, { tone: string; label: string }>> = {
  0: { tone: "priority", label: "À renforcer" },
  50: { tone: "developing", label: "En progrès" },
  100: { tone: "strong", label: "Acquis" },
};

function sessionDuration(session: SavedTrainingSession): number {
  return session.blocks.reduce((total, block) => total + block.durationMinutes, 0);
}

function meetingLabel(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled || !sessionBody.educator) {
          return;
        }

        const [teamResponse, diagnosticResponse, sessionsResponse, observationsResponse, matchesResponse, seasonResponse, seasonSessionsResponse] =
          await Promise.all([
            fetch("/api/team"),
            fetch("/api/diagnostic"),
            fetch("/api/sessions"),
            fetch("/api/observations"),
            fetch("/api/matches"),
            fetch("/api/season-program"),
            fetch("/api/sessions?scope=season"),
          ]);
        const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
        const diagnosticBody = await diagnosticResponse.json().catch(() => ({ scores: null }));
        const sessionsBody = await sessionsResponse.json().catch(() => ({ sessions: [] }));
        const observationsBody = await observationsResponse.json().catch(() => ({ observations: [] }));
        const matchesBody = await matchesResponse.json().catch(() => ({ matches: [] }));
        const seasonBody = await seasonResponse.json().catch(() => ({ program: null }));
        const seasonSessionsBody = await seasonSessionsResponse.json().catch(() => ({ sessions: [] }));
        if (cancelled) {
          return;
        }

        setData({
          displayName: sessionBody.educator.displayName,
          hasTeam: Boolean(teamBody.profile),
          teamName: teamBody.profile?.name ?? null,
          sessionsPerWeek: teamBody.profile?.sessionsPerWeek ?? 2,
          matches: matchesBody.matches ?? [],
          seasonProgram: seasonBody.program ?? null,
          seasonPreparedCount: ((seasonSessionsBody.sessions ?? []) as Array<{ cycleNumber: number }>).filter(
            (session) => session.cycleNumber === guidedSeasonCycle,
          ).length,
          trainingDayCount: teamBody.profile?.trainingDays?.length ?? 0,
          scores: diagnosticBody.scores ?? null,
          sessions: sessionsBody.sessions ?? [],
          observations: observationsBody.observations ?? [],
        });
      } catch {
        // Le tableau de bord reste sur son état de chargement.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = data?.displayName.split(" ")[0];
  const slotsPerWeek = Math.max(data?.trainingDayCount ?? 1, 1);
  const sessions = data?.sessions ?? [];
  const activeWeek = currentCycleWeek(sessions, slotsPerWeek);
  const plan = data?.scores ? buildDevelopmentPlan(summarizeDiagnostic(data.scores)) : null;
  const week = plan?.weeks[activeWeek - 1];
  const totalSlots = slotsPerWeek * trainingCycleWeekCount;
  const doneSlots = Math.min(sessions.length, totalSlots);
  const progress = Math.round((doneSlots / totalSlots) * 100);

  const upcoming = [...sessions]
    .filter((session) => session.meetingAt && new Date(session.meetingAt).getTime() >= now)
    .sort((a, b) => new Date(a.meetingAt!).getTime() - new Date(b.meetingAt!).getTime())[0];
  const freeSlot = firstFreeCycleSlot(sessions, slotsPerWeek);

  const latestObservation = data?.observations[0];
  const signals = latestObservation
    ? diagnosticCriteria
        .map((criterion) => ({
          criterion,
          score: latestObservation.ratings.find((rating) => rating.criterion === criterion.id)?.score ?? 0,
        }))
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
    : [];
  const suggestion = latestObservation && week ? suggestAdjustmentFromObservation(latestObservation, week) : null;

  // Prochain match à jouer : le plus proche à venir, sinon le premier sans date.
  const nextMatch = [...(data?.matches ?? [])]
    .filter((match) => match.status === "scheduled" && (!match.date || new Date(match.date).getTime() >= now - 3 * 3600_000))
    .sort((a, b) => (a.date ? new Date(a.date).getTime() : Infinity) - (b.date ? new Date(b.date).getTime() : Infinity))[0];

  const season = data?.seasonProgram ?? null;
  const seasonWeeks = season ? buildPrioritizedSeason({ priorities: season.priorities as never, sessionsPerWeek: data?.sessionsPerWeek ?? 2 }) : [];
  const seasonWeek = season ? seasonWeekAt(new Date(`${season.startDate}T00:00:00`), new Date(now)) : 0;
  const seasonSlots = seasonWeeks.reduce((sum, seasonWeekItem) => sum + seasonWeekItem.slots.length, 0);

  return (
    <section className="content">
      <header className="topbar">
        <div>
          <TodayDate />
          <h1>{firstName ? `Bonjour ${firstName},` : "Bonjour,"}</h1>
          <p>Voici l&apos;essentiel pour faire progresser ton équipe cette semaine.</p>
        </div>
      </header>

      {data && (
        <>
          <section className="hero-grid home-hero">
            <Link
              aria-label={upcoming ? `Ouvrir la séance : ${upcoming.title}` : "Préparer ma prochaine séance"}
              className="session-card home-primary card-link"
              href={upcoming ? `/session/${upcoming.id}` : freeSlot ? `/session?week=${freeSlot.weekNumber}&slot=${freeSlot.slot}` : "/seances"}
              id="session"
            >
              <div className="card-top">
                <span className="eyebrow">PROCHAINE SÉANCE</span>
                {upcoming?.meetingAt && <span className="date-chip">{meetingLabel(upcoming.meetingAt)}</span>}
              </div>
              <h2>{upcoming ? upcoming.title : freeSlot ? "Ta prochaine séance t’attend" : "Toutes tes séances sont prêtes"}</h2>
              {upcoming ? (
                <div className="session-meta">
                  <span>{sessionDuration(upcoming)} min</span>
                  <span>{upcoming.playerCount} joueurs</span>
                  <span>{upcoming.theme}</span>
                </div>
              ) : (
                <p>{freeSlot ? "Une séance prête en un geste, à partir de ton plan." : "Retrouve-les semaine par semaine."}</p>
              )}
              <span aria-hidden="true" className="primary-button">
                {upcoming ? "Ouvrir la séance" : freeSlot ? "Préparer ma séance" : "Voir mes séances"} <span>→</span>
              </span>
            </Link>

            <article className="home-match">
              <div className="card-top">
                <span className="eyebrow">PROCHAIN MATCH</span>
                {nextMatch && <span className="date-chip">{nextMatch.dateLabel}</span>}
              </div>
              {nextMatch ? (
                <>
                  <div className="home-versus">
                    <strong>{nextMatch.venue === "home" ? (data.teamName ?? "Mon équipe") : nextMatch.opponent}</strong>
                    <span aria-hidden="true">VS</span>
                    <strong>{nextMatch.venue === "home" ? nextMatch.opponent : (data.teamName ?? "Mon équipe")}</strong>
                  </div>
                  {nextMatch.location && <p className="home-match-place">📍 {nextMatch.location}</p>}
                  <Link className="small-primary" href={`/match/${nextMatch.id}`}>
                    Préparer le match
                  </Link>
                </>
              ) : (
                <>
                  <h2>Aucun match prévu</h2>
                  <Link className="small-primary" href="/match">
                    Ajouter un match
                  </Link>
                </>
              )}
            </article>
          </section>

          <section className="home-trio">
            {plan && week ? (
              <Link aria-label="Voir le plan de progression" className="focus-card card-link" href="/plan">
                <div className="card-top">
                  <span className="eyebrow light">
                    PRIORITÉ DU CYCLE · SEMAINE {activeWeek}/{trainingCycleWeekCount}
                  </span>
                  <span className="trend">{week.phase}</span>
                </div>
                <h2>{week.theme}</h2>
                <p>{week.intention}</p>
                <div className="progress-row">
                  <div className="progress-track">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <strong>{progress}%</strong>
                </div>
                <div className="focus-footer">
                  <span>
                    {doneSlots}/{totalSlots} séances préparées
                  </span>
                  <span aria-hidden="true" className="card-cta">
                    Voir le plan →
                  </span>
                </div>
              </Link>
            ) : (
              <Link className="focus-card card-link" href={data.hasTeam ? "/diagnostic" : "/onboarding"}>
                <div className="card-top">
                  <span className="eyebrow light">POUR COMMENCER</span>
                </div>
                <h2>{data.hasTeam ? "Fais ton diagnostic" : "Crée ton équipe"}</h2>
                <p>
                  {data.hasTeam
                    ? "Il choisit les priorités de ton cycle de quatre semaines."
                    : "Catégorie, format de jeu et jours d’entraînement : ton plan part de là."}
                </p>
              </Link>
            )}

            {/* Calendrier de la semaine : la composition du prochain match est sur la page Mon équipe. */}
            <WeeklyCalendar />

            <Link aria-label="Voir ma saison" className="home-card card-link" href="/saison">
              <span className="eyebrow">MA SAISON</span>
              {season ? (
                <>
                  <h2>
                    Semaine {Math.min(seasonWeek, seasonWeeks.length)} sur {seasonWeeks.length}
                  </h2>
                  <p>Priorités : {season.priorities.join(" · ")}</p>
                  <p className="home-card-figure">
                    {data.seasonPreparedCount} séance{data.seasonPreparedCount > 1 ? "s" : ""} préparée{data.seasonPreparedCount > 1 ? "s" : ""} sur{" "}
                    {seasonSlots}
                  </p>
                </>
              ) : (
                <>
                  <h2>Lance ta saison guidée</h2>
                  <p>Choisis tes priorités : la saison se construit semaine par semaine.</p>
                </>
              )}
            </Link>
          </section>

          <section className="section-head">
            <div>
              <span className="eyebrow">SIGNAL TERRAIN</span>
              <h2>Ce qui mérite ton attention</h2>
            </div>
            <Link className="text-button" href="/observations">
              Toutes les observations →
            </Link>
          </section>
          {latestObservation ? (
            <section className="priority-grid">
              {signals.map(({ criterion, score }) => (
                <article className="priority-card" key={criterion.id}>
                  <div className={`score ${levelByScore[score]?.tone ?? "developing"}`}>
                    <strong>{score}</strong>
                    <span>/100</span>
                  </div>
                  <div>
                    <h3>{criterion.label}</h3>
                    <p>
                      {levelByScore[score]?.label} · {latestObservation.title}
                    </p>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <p className="dashboard-empty">
              Aucune observation pour l’instant. <Link href="/observation">Note ce que tu as vu</Link> après ta prochaine séance ou ton prochain match.
            </p>
          )}

          <section className="bottom-grid" id="team">
            <article className="insight-card">
              <div>
                <span className="eyebrow">AJUSTEMENT DE SÉANCE</span>
                {suggestion && latestObservation ? (
                  <>
                    <h3>{suggestion.title}</h3>
                    <p>{suggestion.reason}</p>
                    <div className="actions">
                      <Link className="small-primary" href={`/observations/${latestObservation.id}`}>
                        Voir l’observation
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>Tes ajustements apparaîtront ici.</h3>
                    <p>Ils s’appuient sur ta dernière observation et sur la semaine en cours de ton cycle.</p>
                  </>
                )}
              </div>
            </article>
          </section>
        </>
      )}
    </section>
  );
}
