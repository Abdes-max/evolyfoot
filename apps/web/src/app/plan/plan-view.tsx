"use client";

import { buildDevelopmentPlan, summarizeDiagnostic, type DiagnosticScores } from "@evolyfoot/domain";
import Link from "next/link";
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled || !sessionBody.educator) {
          return;
        }

        const [diagnosticResponse, teamResponse, sessionsResponse] = await Promise.all([
          fetch("/api/diagnostic"),
          fetch("/api/team"),
          fetch("/api/sessions"),
        ]);
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
      } catch {
        // Reste sur le diagnostic de démonstration.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const plan = buildDevelopmentPlan(summarizeDiagnostic(scores));
  const activeWeek = useMemo(() => currentCycleWeek(sessions, slotsPerWeek), [sessions, slotsPerWeek]);

  return (
    <>
      <SidebarNav />
      <main className="plan-shell">
      <header className="page-header plan-header">
        <div>
          <span className="eyebrow light">ÉTAPE 3 SUR 3</span>
          <h1 title="Ton premier cycle est prêt.">Ton premier cycle est prêt.</h1>
          <p title={plan.explanation}>{plan.explanation}</p>
        </div>
        <span className="plan-duration">4 semaines · 8 séances</span>
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
          <Link className="continue-button" href="/session">
            Préparer la première séance <span aria-hidden="true">→</span>
          </Link>
          <Link className="back-link" href="/diagnostic">
            Ajuster mon diagnostic
          </Link>
        </div>
      </section>
      </main>
    </>
  );
}
