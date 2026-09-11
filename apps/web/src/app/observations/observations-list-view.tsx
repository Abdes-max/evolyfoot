"use client";

import type { ObservationEventType, ObservationLevel } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";

interface ObservationSummary {
  id: string;
  eventType: ObservationEventType;
  title: string;
  dateLabel: string;
  summary: { trend: ObservationLevel };
}

const eventTypeLabel: Record<ObservationEventType, string> = { training: "Séance", match: "Match" };
const trendLabel: Record<ObservationLevel, string> = { reinforce: "À renforcer", progress: "En progrès", achieved: "Acquis" };

export function ObservationsListView() {
  const [authenticated, setAuthenticated] = useState<boolean | undefined>(undefined);
  const [observations, setObservations] = useState<ObservationSummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled) {
          return;
        }
        const isAuthenticated = Boolean(sessionBody.educator);
        setAuthenticated(isAuthenticated);
        if (!isAuthenticated) {
          return;
        }

        const observationsResponse = await fetch("/api/observations");
        const observationsBody = await observationsResponse.json().catch(() => ({ observations: [] }));
        if (cancelled) {
          return;
        }
        setObservations(observationsBody.observations ?? []);
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

  return (
    <main className="observations-shell">
      <header className="page-header observations-header">
        <div>
          <span className="eyebrow light">OBSERVATIONS</span>
          <h1 title="L’historique de tes observations.">L’historique de tes observations.</h1>
          <p title="Chaque observation validée après une séance ou un match, pour suivre ce qui progresse.">
            Chaque observation validée après une séance ou un match, pour suivre ce qui progresse.
          </p>
        </div>
      </header>

      {authenticated === false && (
        <section className="observations-auth-required" role="status">
          <p>
            Connecte-toi pour consulter tes observations. <Link className="inline-cta" href="/connexion">Se connecter →</Link>
          </p>
        </section>
      )}

      {authenticated && (
        <section className="observations-content">
          {observations.length === 0 ? (
            <p className="observations-empty">
              Aucune observation pour l’instant. Elles apparaissent ici après une séance ou un match.
            </p>
          ) : (
            <ul className="observations-list" aria-label="Observations">
              {observations.map((observation) => (
                <li key={observation.id}>
                  <Link
                    aria-label={`${observation.title} — Voir le détail`}
                    className="observation-card card-link"
                    href={`/observations/${observation.id}`}
                  >
                    <div className="observation-card-top">
                      <span className="observation-type-badge" aria-hidden="true">
                        {eventTypeLabel[observation.eventType]}
                      </span>
                      <span className={`observation-trend-badge observation-trend-${observation.summary.trend}`} aria-hidden="true">
                        {trendLabel[observation.summary.trend]}
                      </span>
                    </div>
                    <h2 aria-hidden="true">{observation.title}</h2>
                    <p aria-hidden="true">{observation.dateLabel}</p>
                    <span aria-hidden="true" className="observation-card-link card-cta">
                      Voir le détail →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link className="back-link" href="/app">
            Retour au tableau de bord
          </Link>
        </section>
      )}
    </main>
  );
}
