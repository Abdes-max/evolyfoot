"use client";

import { buildDevelopmentPlan, summarizeDiagnostic, type DiagnosticScores } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SidebarNav } from "../sidebar-nav";

// Diagnostic de démonstration, utilisé tant qu'aucun diagnostic réel n'est disponible
// (visiteur anonyme, ou éducateur connecté n'ayant pas encore fait le sien).
const demoScores: DiagnosticScores = { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 };

export function PlanView() {
  const [scores, setScores] = useState<DiagnosticScores>(demoScores);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled || !sessionBody.educator) {
          return;
        }

        const diagnosticResponse = await fetch("/api/diagnostic");
        const diagnosticBody = await diagnosticResponse.json().catch(() => ({ scores: null }));
        if (!cancelled && diagnosticBody.scores) {
          setScores(diagnosticBody.scores);
        }
      } catch {
        // Reste sur le diagnostic de démonstration.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const plan = buildDevelopmentPlan(summarizeDiagnostic(scores));

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
                <span className="phase">{week.phase}</span>
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
