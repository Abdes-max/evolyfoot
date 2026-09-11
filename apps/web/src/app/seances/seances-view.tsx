"use client";

import { buildDevelopmentPlan, summarizeDiagnostic, type DiagnosticScores } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { currentCycleWeek, trainingCycleWeekCount } from "../session/cycle";

interface SavedSession {
  id: string;
  title: string;
  theme: string;
  weekNumber: number;
  slot: number;
  blocks: ReadonlyArray<{ durationMinutes: number }>;
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

        const [teamResponse, diagnosticResponse, sessionsResponse] = await Promise.all([
          fetch("/api/team"),
          fetch("/api/diagnostic"),
          fetch("/api/sessions"),
        ]);
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

  const sessionAt = (weekNumber: number, slot: number) =>
    sessions.find((session) => session.weekNumber === weekNumber && session.slot === slot);

  return (
    <main className="seances-shell">
      <header className="page-header seances-header">
        <div>
          <span className="eyebrow light">Mes séances</span>
          <h1 title="Le cycle de quatre semaines, séance par séance.">Le cycle de quatre semaines, séance par séance.</h1>
          <p title="Génère chaque séance à partir du plan, puis ajuste-la avant l’entraînement.">
            Génère chaque séance à partir du plan, puis ajuste-la avant l’entraînement.
          </p>
        </div>
        <Link className="seances-create" href={`/session?week=${activeWeek}&slot=0`}>
          Créer une séance
        </Link>
      </header>

      <section className="seances-content">
        <Link className="seances-library-link" href="/bibliotheque">
          Parcourir la bibliothèque d’exercices →
        </Link>

        {authenticated === false && (
          <p className="seances-auth">
            <Link href="/connexion">Connecte-toi</Link> pour générer et retrouver tes séances.
          </p>
        )}

        {trainingDays.length === 0 && authenticated && (
          <p className="seances-hint">
            Renseigne les jours d’entraînement de ton équipe dans <Link href="/equipe">Mon équipe</Link> pour caler les créneaux sur ta semaine réelle.
          </p>
        )}

        {plan.weeks.map((week) => {
          const weekNumber = week.week;
          return (
            <article
              className={weekNumber === activeWeek ? "seances-week active" : "seances-week"}
              key={weekNumber}
            >
              <header className="seances-week-head">
                <div>
                  <span className="seances-week-number">S{weekNumber}</span>
                  <div>
                    <h2>{week.intention}</h2>
                    <p>
                      {week.phase} · {week.theme}
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
                        <Link className="seances-slot-card generated" href={`/session/${saved.id}`}>
                          <strong>{saved.title}</strong>
                          <span>
                            {sessionDuration(saved)} min · {saved.theme}
                          </span>
                          <span className="seances-slot-cta">Ouvrir la séance →</span>
                        </Link>
                      ) : (
                        <Link
                          className="seances-slot-card pending"
                          href={`/session?week=${weekNumber}&slot=${slot}`}
                        >
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
          {trainingCycleWeekCount} semaines · {slotLabels.length} séance{slotLabels.length > 1 ? "s" : ""} par semaine.
        </p>
      </section>
    </main>
  );
}
