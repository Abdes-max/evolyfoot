"use client";

import {
  buildDevelopmentPlan,
  buildPrioritizedSeason,
  guidedSeasonCycle,
  nextSeasonSlot,
  seasonCycles,
  seasonWeekAt,
  summarizeDiagnostic,
  themeColors,
  type DevelopmentTheme,
  type DiagnosticScores,
} from "@evolyfoot/domain";
import Link from "next/link";
import { ConvocationSettings } from "../convocation-settings";
import { useEffect, useMemo, useState } from "react";
import { cycleWeekDateRangeLabel } from "../date-format";
import { SeasonCycleWeeks } from "./season-cycle-weeks";
import { currentCycleWeek, firstFreeCycleSlot, trainingCycleWeekCount } from "../session/cycle";

interface SavedSession {
  id: string;
  title: string;
  theme: string;
  cycleNumber?: number;
  weekNumber: number;
  slot: number;
  blocks: ReadonlyArray<{ durationMinutes: number }>;
  convokedAt?: string | null;
  attendance?: ReadonlyArray<{ playerId: string; present: boolean }>;
}

// « 8 présents · 2 absents » sur la carte d'une séance convoquée, « Programmée » avant l'envoi.
function responsesLabel(session: SavedSession): string {
  if (!session.convokedAt) return "Programmée";
  const present = (session.attendance ?? []).filter((entry) => entry.present).length;
  const absent = (session.attendance ?? []).length - present;
  return `${present} présent${present > 1 ? "s" : ""} · ${absent} absent${absent > 1 ? "s" : ""}`;
}

const demoScores: DiagnosticScores = { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 };
// Repli quand l'équipe n'a pas encore de jours d'entraînement : deux créneaux par semaine, le
// rythme le plus courant en U10–U13.
const fallbackSlotLabels = ["Séance 1", "Séance 2"];

function sessionDuration(session: SavedSession): number {
  return session.blocks.reduce((total, block) => total + block.durationMinutes, 0);
}

export function SeancesView() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [scores, setScores] = useState<DiagnosticScores>(demoScores);
  const [trainingDays, setTrainingDays] = useState<readonly string[]>([]);
  const [sessions, setSessions] = useState<readonly SavedSession[]>([]);
  // Saison guidée : la page montre alors ses cycles de 4 semaines (voir seasonCycles).
  const [program, setProgram] = useState<{ priorities: DevelopmentTheme[]; startDate: string } | null>(null);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(2);
  const [seasonSessions, setSeasonSessions] = useState<readonly SavedSession[]>([]);
  const [cycleOffset, setCycleOffset] = useState(0);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled) {
          return;
        }
        if (!sessionBody.educator) {
          setAuthenticated(false);
          return;
        }
        setAuthenticated(true);

        const [teamResponse, diagnosticResponse, sessionsResponse, programResponse, seasonSessionsResponse] = await Promise.all([
          fetch("/api/team"),
          fetch("/api/diagnostic"),
          fetch("/api/sessions"),
          fetch("/api/season-program"),
          fetch("/api/sessions?scope=season"),
        ]);
        const programBody = await programResponse.json().catch(() => ({ program: null }));
        const seasonSessionsBody = await seasonSessionsResponse.json().catch(() => ({ sessions: [] }));
        const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
        const diagnosticBody = await diagnosticResponse.json().catch(() => ({ scores: null }));
        const sessionsBody = await sessionsResponse.json().catch(() => ({ sessions: [] }));
        if (cancelled) {
          return;
        }

        setTrainingDays(teamBody.profile?.trainingDays ?? []);
        if (diagnosticBody.scores) {
          setScores(diagnosticBody.scores);
        }
        setSessions(sessionsBody.sessions ?? []);
        setProgram(programBody.program ?? null);
        setSessionsPerWeek(teamBody.profile?.sessionsPerWeek ?? 2);
        setSeasonSessions(((seasonSessionsBody.sessions ?? []) as SavedSession[]).filter((session) => session.cycleNumber === guidedSeasonCycle));
      } catch {
        // Reste sur un plan de démonstration et une liste vide.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const plan = useMemo(() => buildDevelopmentPlan(summarizeDiagnostic(scores)), [scores]);
  const slotLabels = trainingDays.length > 0 ? trainingDays : fallbackSlotLabels;
  const activeWeek = currentCycleWeek(sessions, slotLabels.length);

  const sessionAt = (weekNumber: number, slot: number) => sessions.find((session) => session.weekNumber === weekNumber && session.slot === slot);

  // Premier créneau libre du cycle ; le premier créneau de la semaine en cours si tout est généré.
  const nextSlot = firstFreeCycleSlot(sessions, slotLabels.length) ?? { weekNumber: activeWeek, slot: 0 };

  const seasonWeeks = useMemo(() => (program ? buildPrioritizedSeason({ priorities: program.priorities, sessionsPerWeek }) : []), [program, sessionsPerWeek]);
  const cycles = useMemo(() => seasonCycles(seasonWeeks), [seasonWeeks]);
  const currentSeasonWeek = program ? seasonWeekAt(new Date(`${program.startDate}T00:00:00`), now) : 0;
  const currentCycleIndex = Math.max(
    0,
    cycles.findIndex((cycle) => cycle.weeks.some((week) => week.seasonWeek === currentSeasonWeek)),
  );
  const shownCycle = cycles[Math.min(cycles.length - 1, Math.max(0, currentCycleIndex + cycleOffset))] ?? null;
  const nextGuided = program ? nextSeasonSlot(seasonWeeks, seasonSessions, currentSeasonWeek) : null;

  return (
    <main className="seances-shell">
      <header className="page-header seances-header">
        <div>
          <span className="eyebrow light">Mes séances</span>
          <h1 title="Le cycle de quatre semaines, séance par séance.">
            {shownCycle ? `Cycle ${shownCycle.number} sur ${shownCycle.count} de ta saison.` : "Le cycle de quatre semaines, séance par séance."}
          </h1>
          <p title="Génère chaque séance à partir du plan, puis ajuste-la avant l’entraînement.">
            Génère chaque séance à partir du plan, puis ajuste-la avant l’entraînement.
          </p>
        </div>
        <Link
          className="seances-create"
          href={
            program
              ? nextGuided
                ? `/saison/seance/${nextGuided.slot.sessionNumber}?semaine=${nextGuided.week}&creneau=${nextGuided.index}`
                : "/saison"
              : `/session?week=${nextSlot.weekNumber}&slot=${nextSlot.slot}`
          }
        >
          {program ? "Préparer ma prochaine séance" : "Générer ma prochaine séance"}
        </Link>
      </header>

      <section className="seances-content">
        <Link className="seances-library-link" href="/bibliotheque">
          Parcourir la bibliothèque d’exercices →
        </Link>
        <Link className="seances-library-link" href="/saison">
          Voir toute la saison →
        </Link>

        {authenticated === false && (
          <p className="seances-auth">
            <Link href="/connexion">Connecte-toi</Link> pour générer et retrouver tes séances.
          </p>
        )}

        {authenticated && <ConvocationSettings prompt />}

        {trainingDays.length === 0 && authenticated && (
          <p className="seances-hint">
            Renseigne les jours d’entraînement de ton équipe dans <Link href="/equipe">Mon équipe</Link> pour caler les créneaux sur ta semaine réelle.
          </p>
        )}

        {shownCycle && program && (
          <>
            <nav aria-label="Cycles de la saison" className="seances-cycle-nav">
              <button disabled={currentCycleIndex + cycleOffset <= 0} onClick={() => setCycleOffset(cycleOffset - 1)} type="button">
                ‹ Cycle précédent
              </button>
              <span>
                Cycle {shownCycle.number}/{shownCycle.count} · <strong style={{ color: themeColors[shownCycle.theme] }}>{shownCycle.theme}</strong>
                {shownCycle.supportTheme ? ` · en soutien : ${shownCycle.supportTheme}` : ""}
              </span>
              <button disabled={currentCycleIndex + cycleOffset >= cycles.length - 1} onClick={() => setCycleOffset(cycleOffset + 1)} type="button">
                Cycle suivant ›
              </button>
            </nav>
            <SeasonCycleWeeks
              currentSeasonWeek={currentSeasonWeek}
              cycle={shownCycle}
              prepared={seasonSessions}
              slotLabels={slotLabels}
              startDate={program.startDate}
            />
          </>
        )}

        {!program &&
          plan.weeks.map((week) => {
            const weekNumber = week.week;
            return (
              <article
                className={weekNumber === activeWeek ? "seances-week active" : "seances-week"}
                key={weekNumber}
                style={{ borderLeft: `4px solid ${themeColors[week.theme]}` }}
              >
                <header className="seances-week-head">
                  <div>
                    <span className="seances-week-number">S{weekNumber}</span>
                    <div>
                      <h2>{week.intention}</h2>
                      <p>
                        {cycleWeekDateRangeLabel(weekNumber, activeWeek)} · {week.phase} · {week.theme}
                      </p>
                    </div>
                  </div>
                  {weekNumber === activeWeek && <span className="seances-week-tag">Semaine en cours</span>}
                </header>
                <ul className="seances-slot-list">
                  {slotLabels.map((label, slot) => {
                    const saved = sessionAt(weekNumber, slot);
                    return (
                      <li className="seances-slot" key={slot}>
                        <span className="seances-slot-label">{label}</span>
                        {saved ? (
                          <Link
                            className="seances-slot-card generated"
                            href={`/session/${saved.id}`}
                            style={{ borderLeft: `4px solid ${themeColors[saved.theme as DevelopmentTheme] ?? "var(--line)"}` }}
                          >
                            <strong>{saved.title}</strong>
                            <span>
                              {sessionDuration(saved)} min · {saved.theme}
                            </span>
                            <span className={saved.convokedAt ? "seances-slot-responses" : "seances-slot-responses scheduled"}>{responsesLabel(saved)}</span>
                            <span className="seances-slot-cta">Ouvrir la séance →</span>
                          </Link>
                        ) : (
                          <Link className="seances-slot-card pending" href={`/session?week=${weekNumber}&slot=${slot}`}>
                            <strong>Séance non générée</strong>
                            <span>À partir du plan de la semaine {weekNumber}</span>
                            <span className="seances-slot-cta">Générer cette séance →</span>
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}

        <p className="seances-foot">
          {program ? "Cycle de " : ""}
          {trainingCycleWeekCount} semaines · {slotLabels.length} séance{slotLabels.length > 1 ? "s" : ""} par semaine.
        </p>
      </section>
    </main>
  );
}
