"use client";

import { diagnosticCriteria } from "@evolyfoot/domain";
import type {
  ObservationEventType,
  ObservationLevel,
  ObservationReportRating,
  ObservationReportSummary,
  ObservationSummaryRating,
  PlayerReference,
  PlayerSignal,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";

function criterionLabel(criterion: string): string {
  return diagnosticCriteria.find((candidate) => candidate.id === criterion)?.label ?? criterion;
}

interface ObservationDetail {
  id: string;
  eventType: ObservationEventType;
  title: string;
  dateLabel: string;
  players: readonly PlayerReference[];
  ratings: readonly ObservationReportRating[];
  signals: readonly PlayerSignal[];
  note?: string;
  summary: ObservationReportSummary;
  matchId?: string;
}

const eventTypeLabel: Record<ObservationEventType, string> = { training: "Séance", match: "Match" };
const levelLabel: Record<ObservationLevel, string> = { reinforce: "À renforcer", progress: "En progrès", achieved: "Acquis" };
const trendLabel: Record<ObservationLevel, string> = { reinforce: "À renforcer", progress: "En progrès", achieved: "Acquis" };

function ratingLabel(rating: ObservationSummaryRating): string {
  return rating.label;
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : "Une erreur est survenue.";
}

export function ObservationDetailView({ observationId }: { observationId: string }) {
  const [authenticated, setAuthenticated] = useState<boolean | undefined>(undefined);
  const [observation, setObservation] = useState<ObservationDetail | null>(null);
  const [loadError, setLoadError] = useState("");

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

        const response = await fetch(`/api/observations/${observationId}`);
        if (!response.ok) {
          setLoadError(await readErrorMessage(response));
          return;
        }
        const body = await response.json();
        if (cancelled) {
          return;
        }
        setObservation(body.observation);
      } catch {
        if (!cancelled) {
          setLoadError("Une erreur est survenue.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [observationId]);

  if (authenticated === false) {
    return (
      <main className="observations-shell">
        <section className="observations-auth-required" role="status">
          <p>
            Connecte-toi pour consulter cette observation. <Link className="inline-cta" href="/connexion">Se connecter →</Link>
          </p>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="observations-shell">
        <section className="observation-detail-content">
          <p className="field-error" role="alert">
            {loadError}
          </p>
          <Link className="back-link" href="/observations">
            Retour aux observations
          </Link>
        </section>
      </main>
    );
  }

  if (!observation) {
    return <main className="observations-shell" />;
  }

  return (
    <main className="observations-shell">
      <header className="page-header observations-header">
        <Link className="onboarding-brand" href="/app">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <div>
          <span className="eyebrow light">{eventTypeLabel[observation.eventType]}</span>
          <h1 title={observation.title}>{observation.title}</h1>
          <p title={observation.dateLabel}>{observation.dateLabel}</p>
        </div>
      </header>

      <section className="observation-detail-content">
        <div className="observation-detail-meta">
          {observation.matchId && (
            <Link className="inline-cta" href={`/match/${observation.matchId}`}>
              Voir le match →
            </Link>
          )}
        </div>

        <dl className="observation-detail-summary">
          <div>
            <dt>Score moyen</dt>
            <dd>{Math.round(observation.summary.averageScore)}/100</dd>
          </div>
          <div>
            <dt>Tendance</dt>
            <dd>{trendLabel[observation.summary.trend]}</dd>
          </div>
          <div>
            <dt>Point fort</dt>
            <dd>{ratingLabel(observation.summary.strongest)}</dd>
          </div>
          <div>
            <dt>À travailler</dt>
            <dd>{ratingLabel(observation.summary.weakest)}</dd>
          </div>
        </dl>

        <div className="observation-detail-block">
          <h2>Comportements observés</h2>
          <div className="observation-detail-ratings">
            {observation.ratings.map((rating) => (
              <div className="observation-detail-rating" key={rating.criterion}>
                <strong>{criterionLabel(rating.criterion)}</strong>
                <span className={`observation-trend-badge observation-trend-${rating.level}`}>{levelLabel[rating.level]}</span>
              </div>
            ))}
          </div>
        </div>

        {observation.signals.length > 0 && (
          <div className="observation-detail-block">
            <h2>Joueurs à suivre</h2>
            <div className="observation-detail-signals">
              {observation.signals.map((signal) => (
                <span className={`observation-detail-signal ${signal.kind}`} key={signal.playerId}>
                  {signal.playerName} · {signal.kind === "highlight" ? "à mettre en avant" : "à accompagner"}
                </span>
              ))}
            </div>
          </div>
        )}

        {observation.players.length > 0 && (
          <div className="observation-detail-block">
            <h2>Joueurs concernés</h2>
            <div className="observation-detail-players">
              {observation.players.map((player) => (
                <span key={player.id}>{player.name}</span>
              ))}
            </div>
          </div>
        )}

        {observation.note && (
          <div className="observation-detail-block">
            <h2>Note</h2>
            <p className="observation-detail-note">{observation.note}</p>
          </div>
        )}

        <Link className="back-link" href="/observations">
          Retour aux observations
        </Link>
      </section>
    </main>
  );
}
