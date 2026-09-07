"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface FunnelStep {
  label: string;
  count: number;
}

interface WeeklyActivityPoint {
  weekStart: string;
  activeEducators: number;
}

interface MvpMetrics {
  funnel: FunnelStep[];
  weeklyActivity: WeeklyActivityPoint[];
  retention: { retainedFourWeeks: number; activeLastFourWeeks: number };
  rosterAdoption: { educatorsWithPlayers: number; totalEducators: number };
}

type Status = "loading" | "denied" | "error" | "ready";

function formatWeekLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
}

export function MetricsView() {
  const [status, setStatus] = useState<Status>("loading");
  const [metrics, setMetrics] = useState<MvpMetrics | null>(null);

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
          setStatus("denied");
          return;
        }

        const response = await fetch("/api/admin/metrics");
        if (cancelled) {
          return;
        }
        if (response.status === 401 || response.status === 403) {
          setStatus("denied");
          return;
        }
        if (!response.ok) {
          setStatus("error");
          return;
        }
        const body: MvpMetrics = await response.json();
        setMetrics(body);
        setStatus("ready");
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

  return (
    <main className="metrics-shell">
      <header className="metrics-header">
        <Link className="onboarding-brand" href="/">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <span className="eyebrow light">TABLEAU DE BORD</span>
        <h1>Indicateurs MVP.</h1>
        <p>
          Deux des quatre indicateurs de docs/mvp.md — les autres (chronométrage de la séance et de
          l’observation, acceptation d’un ajustement) demandent une instrumentation qui n’existe pas
          encore.
        </p>
      </header>

      {status === "loading" && <p className="metrics-loading">Chargement…</p>}
      {status === "denied" && (
        <p className="metrics-denied">
          Accès réservé. <Link href="/connexion">Se connecter</Link> avec un compte autorisé.
        </p>
      )}
      {status === "error" && <p className="metrics-denied">Une erreur est survenue, réessaie plus tard.</p>}

      {status === "ready" && metrics && (
        <div className="metrics-content">
          <section className="metrics-section" aria-labelledby="funnel-title">
            <div className="metrics-section-head">
              <h2 id="funnel-title">Entonnoir d’activation</h2>
              <p className="metrics-section-note">
                De l’inscription à la première observation, par nombre d’éducateurs distincts.
              </p>
            </div>
            <div className="funnel">
              {metrics.funnel.map((step, index) => {
                const first = metrics.funnel[0]?.count ?? 0;
                const previous = index > 0 ? metrics.funnel[index - 1].count : null;
                const widthPercent = first > 0 ? Math.max((step.count / first) * 100, step.count > 0 ? 4 : 0) : 0;
                const conversion = previous && previous > 0 ? Math.round((step.count / previous) * 100) : null;
                return (
                  <div className="funnel-step" key={step.label}>
                    <span className="funnel-label">{step.label}</span>
                    <div className="funnel-track">
                      <div className="funnel-bar" style={{ width: `${widthPercent}%` }} />
                      <span className={`funnel-count${widthPercent < 22 ? " on-track" : ""}`}>{step.count}</span>
                    </div>
                    <span className={`funnel-conversion${conversion === null ? " first" : ""}`}>
                      {conversion === null ? "—" : `${conversion}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="metrics-section" aria-labelledby="weekly-title">
            <div className="metrics-section-head">
              <h2 id="weekly-title">Éducateurs actifs par semaine</h2>
              <p className="metrics-section-note">Au moins une séance ou une observation validée cette semaine-là.</p>
            </div>
            {metrics.weeklyActivity.length > 0 ? (
              <div className="week-chart">
                {metrics.weeklyActivity.map((point) => {
                  const max = Math.max(...metrics.weeklyActivity.map((p) => p.activeEducators), 1);
                  const heightPercent = Math.max((point.activeEducators / max) * 100, point.activeEducators > 0 ? 6 : 2);
                  return (
                    <div className="week-bar-wrap" key={point.weekStart}>
                      <span className="week-value">{point.activeEducators}</span>
                      <div className="week-bar" style={{ height: `${heightPercent}%` }} />
                      <span className="week-label">{formatWeekLabel(point.weekStart)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="kpi-hint">Aucune activité enregistrée sur les huit dernières semaines.</p>
            )}
          </section>

          <section className="kpi-grid" aria-label="Indicateurs complémentaires">
            <div className="kpi-card">
              <p className="kpi-label">Rétention 4 semaines</p>
              <p className="kpi-value">
                {metrics.retention.retainedFourWeeks}
                <small> / {metrics.retention.activeLastFourWeeks} actifs</small>
              </p>
              <p className="kpi-hint">
                Éducateurs actifs chacune des 4 dernières semaines, parmi ceux actifs au moins une fois sur
                la période — opérationnalise « utilisation hebdomadaire pendant quatre semaines
                consécutives ».
              </p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Effectif nominatif renseigné</p>
              <p className="kpi-value">
                {metrics.rosterAdoption.educatorsWithPlayers}
                <small> / {metrics.rosterAdoption.totalEducators} comptes</small>
              </p>
              <p className="kpi-hint">A ajouté au moins un joueur nommé sur /equipe — signe d’un usage allant au-delà de la démo.</p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
