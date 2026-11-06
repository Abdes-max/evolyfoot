"use client";

import {
  buildDevelopmentPlan,
  buildPrioritizedSeason,
  guidedSeasonCycle,
  nextSeasonSlot,
  seasonCycleAsPlan,
  seasonCycleAt,
  seasonCycles,
  seasonWeekAt,
  summarizeDiagnostic,
  trainingCycleWeekCount,
  type DevelopmentTheme,
  type DiagnosticScores,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cycleWeekDateRangeLabel } from "../date-format";
import { SidebarNav } from "../sidebar-nav";
import { currentCycleWeek } from "../session/cycle";

// Diagnostic de démonstration, utilisé tant qu'aucun diagnostic réel n'est disponible
// (visiteur anonyme, ou éducateur connecté n'ayant pas encore fait le sien).
const demoScores: DiagnosticScores = { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 };
const fallbackSlotsPerWeek = 2;

interface SavedSession {
  weekNumber: number;
}

export function PlanView() {
  const [scores, setScores] = useState<DiagnosticScores>(demoScores);
  const [sessions, setSessions] = useState<readonly SavedSession[]>([]);
  const [slotsPerWeek, setSlotsPerWeek] = useState(fallbackSlotsPerWeek);
  const [cycleNumber, setCycleNumber] = useState(1);
  const [starting, setStarting] = useState(false);
  const [cycleError, setCycleError] = useState("");
  // Saison guidée : le cycle affiché est alors celui de la saison (voir seasonCycles).
  const [program, setProgram] = useState<{ priorities: DevelopmentTheme[]; startDate: string } | null>(null);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(2);
  const [preparedSeasonSlots, setPreparedSeasonSlots] = useState<{ weekNumber: number; slot: number }[]>([]);
  const [now] = useState(() => new Date());
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled || !sessionBody.educator) {
          return;
        }

        const [diagnosticResponse, teamResponse, sessionsResponse, programResponse, seasonSessionsResponse] = await Promise.all([
          fetch("/api/diagnostic"),
          fetch("/api/team"),
          fetch("/api/sessions"),
          fetch("/api/season-program"),
          fetch("/api/sessions?scope=season"),
        ]);
        const programBody = await programResponse.json().catch(() => ({ program: null }));
        const seasonSessionsBody = await seasonSessionsResponse.json().catch(() => ({ sessions: [] }));
        const diagnosticBody = await diagnosticResponse.json().catch(() => ({ scores: null }));
        const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
        const sessionsBody = await sessionsResponse.json().catch(() => ({ sessions: [] }));
        if (cancelled) {
          return;
        }
        if (diagnosticBody.scores) {
          setScores(diagnosticBody.scores);
        }
        const trainingDays: readonly string[] = teamBody.profile?.trainingDays ?? [];
        setSlotsPerWeek(trainingDays.length > 0 ? trainingDays.length : fallbackSlotsPerWeek);
        setSessions(sessionsBody.sessions ?? []);
        setCycleNumber(sessionsBody.cycleNumber ?? 1);
        setProgram(programBody.program ?? null);
        setSessionsPerWeek(teamBody.profile?.sessionsPerWeek ?? 2);
        setPreparedSeasonSlots(
          ((seasonSessionsBody.sessions ?? []) as Array<{ cycleNumber?: number; weekNumber: number; slot: number }>).filter(
            (session) => session.cycleNumber === guidedSeasonCycle,
          ),
        );
      } catch {
        // Reste sur le diagnostic de démonstration.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const seasonWeeks = useMemo(() => (program ? buildPrioritizedSeason({ priorities: program.priorities, sessionsPerWeek }) : []), [program, sessionsPerWeek]);
  const seasonWeek = program ? seasonWeekAt(new Date(`${program.startDate}T00:00:00`), now) : 0;
  const seasonCycle = program ? seasonCycleAt(seasonCycles(seasonWeeks), seasonWeek) : null;
  const plan = seasonCycle ? seasonCycleAsPlan(seasonCycle) : buildDevelopmentPlan(summarizeDiagnostic(scores));
  const cycleActiveWeek = useMemo(() => currentCycleWeek(sessions, slotsPerWeek), [sessions, slotsPerWeek]);
  const activeWeek = seasonCycle ? (seasonCycle.weeks.find((week) => week.seasonWeek === seasonWeek)?.weekInCycle ?? 1) : cycleActiveWeek;
  const totalSessions = seasonCycle ? seasonCycle.weeks.reduce((sum, week) => sum + week.slots.length, 0) : slotsPerWeek * trainingCycleWeekCount;
  const nextGuided = program ? nextSeasonSlot(seasonWeeks, preparedSeasonSlots, seasonWeek) : null;
  const heading = seasonCycle
    ? `Cycle ${seasonCycle.number} sur ${seasonCycle.count} de ta saison.`
    : cycleNumber === 1
      ? "Ton premier cycle est prêt."
      : `Ton cycle ${cycleNumber} est prêt.`;

  // Le diagnostic se refait à chaque nouveau cycle : c'est lui qui choisit les prochaines priorités.
  async function startNextCycle() {
    setStarting(true);
    setCycleError("");
    try {
      const response = await fetch("/api/cycles/next", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCycleError(typeof body.error === "string" ? body.error : "Le cycle suivant n’a pas pu démarrer.");
        return;
      }
      router.push("/diagnostic");
    } catch {
      setCycleError("Le cycle suivant n’a pas pu démarrer, réessaie.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <SidebarNav />
      <main className="plan-shell">
        <header className="page-header plan-header">
          <div>
            <span className="eyebrow light">ÉTAPE 3 SUR 3</span>
            <h1 title={heading}>{heading}</h1>
            <p title={plan.explanation}>{plan.explanation}</p>
          </div>
          <span className="plan-duration">4 semaines · {totalSessions} séances</span>
        </header>
        <section className="plan-content">
          <div className="plan-summary">
            <div>
              <span className="eyebrow">FIL DIRECTEUR</span>
              <h2>{plan.title}</h2>
            </div>
            <div>
              <small>Priorité</small>
              <strong>{plan.primaryTheme}</strong>
            </div>
            <div>
              <small>En soutien</small>
              <strong>{plan.secondaryTheme}</strong>
            </div>
          </div>
          <div className="week-list">
            {plan.weeks.map((week) => (
              <article className="development-week" key={week.week}>
                <span className="week-number">S{week.week}</span>
                <div>
                  <span className="phase">
                    {cycleWeekDateRangeLabel(week.week, activeWeek)} · {week.phase}
                  </span>
                  <h2>{week.intention}</h2>
                  <p>{week.observable}</p>
                </div>
                <span className="theme-chip">{week.theme}</span>
              </article>
            ))}
          </div>
          <div className="plan-actions">
            {seasonCycle ? (
              <>
                <Link
                  className="continue-button"
                  href={nextGuided ? `/saison/seance/${nextGuided.slot.sessionNumber}?semaine=${nextGuided.week}&creneau=${nextGuided.index}` : "/saison"}
                >
                  {nextGuided ? "Préparer la prochaine séance" : "Voir ma saison"} <span aria-hidden="true">→</span>
                </Link>
                <Link className="back-link" href="/saison">
                  Toute ma saison et ses priorités
                </Link>
              </>
            ) : sessions.length >= totalSessions ? (
              <button className="continue-button" disabled={starting} onClick={startNextCycle} type="button">
                {starting ? "…" : "Démarrer le cycle suivant"} <span aria-hidden="true">→</span>
              </button>
            ) : (
              <Link className="continue-button" href="/session">
                Préparer la première séance <span aria-hidden="true">→</span>
              </Link>
            )}
            {cycleError && (
              <p className="field-error" role="alert">
                {cycleError}
              </p>
            )}
            {!seasonCycle && (
              <Link className="back-link" href="/diagnostic">
                Ajuster mon diagnostic
              </Link>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
