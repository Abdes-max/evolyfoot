"use client";

import {
  playerEvaluationAspectLabels,
  playerEvaluationAspects,
  playerEvaluationMaxScore,
  playerEvaluationMinScore,
} from "@evolyfoot/domain";
import { useState } from "react";
import { DonutChart, RadarChart } from "../../charts";
import { colorForEvaluation } from "../../evaluation-colors";
import { PlayerSpaceHeader } from "../player-space-header";
import { usePlayerDashboard } from "./use-player-dashboard";

const radarAxes = playerEvaluationAspects.map((aspect) => ({ key: aspect, label: playerEvaluationAspectLabels[aspect] }));

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? iso
    : parsed.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Onglet "Mon enfant" (voir player-tab-bar.tsx) : identité, évaluations et présence -- tout ce qui
// décrit le joueur lui-même. Le calendrier et les convocations vivent sur l'onglet Calendrier
// (/joueur/calendrier), pour ne pas surcharger cette page.
export function PlayerSpaceView() {
  const { status, dashboard } = usePlayerDashboard();
  // Évaluations superposées sur le radar -- même mécanisme que côté coach (player-detail-view.tsx),
  // en lecture seule ici : pas d'ajout/modification/retrait, juste comparer.
  const [comparedEvaluationIds, setComparedEvaluationIds] = useState<ReadonlySet<string>>(new Set());
  const [seededCompare, setSeededCompare] = useState(false);

  // Par défaut, seule la dernière évaluation est comparée -- posé au premier rendu où le
  // classement est connu plutôt qu'en useEffect (react-hooks/set-state-in-effect, voir
  // auth-gate.tsx) : un simple indicateur `seededCompare` évite de réinitialiser la sélection à
  // chaque re-rendu une fois que l'utilisateur a lui-même coché/décoché une case.
  if (!seededCompare && dashboard?.evaluations[0]) {
    setComparedEvaluationIds(new Set([dashboard.evaluations[0].id]));
    setSeededCompare(true);
  }

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
      <PlayerSpaceHeader />

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
          </>
        )}
      </main>
    </div>
  );
}
