"use client";

import { buildSeasonPlan, currentCycleWeek, type DiagnosticScores } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface PlanData {
  scores: DiagnosticScores | null;
  cycleNumber: number;
  activeWeek: number;
}

function shortDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function SeasonPlanView({ now }: { now: Date }) {
  const [data, setData] = useState<PlanData | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [diagnosticResponse, sessionsResponse, teamResponse] = await Promise.all([
        fetch("/api/diagnostic"),
        fetch("/api/sessions"),
        fetch("/api/team"),
      ]).catch(() => []);
      const diagnosticBody = await diagnosticResponse?.json().catch(() => null);
      const sessionsBody = await sessionsResponse?.json().catch(() => null);
      const teamBody = await teamResponse?.json().catch(() => null);
      if (cancelled) {
        return;
      }
      setData({
        scores: diagnosticBody?.scores ?? null,
        cycleNumber: sessionsBody?.cycleNumber ?? 1,
        activeWeek: currentCycleWeek(sessionsBody?.sessions ?? [], teamBody?.profile?.trainingDays?.length ?? 1),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const cycles = useMemo(() => (data?.scores ? buildSeasonPlan(data.scores, data.cycleNumber, data.activeWeek, now) : []), [data, now]);

  if (!data) {
    return null;
  }

  return (
    <section aria-labelledby="season-plan-title" className="season-plan">
      <h2 id="season-plan-title">Le plan de ta saison</h2>
      {data.scores ? (
        <>
          <p>Tes priorités reviennent à tour de rôle jusqu’en juin. Ce plan se met à jour à chaque nouveau diagnostic.</p>
          <ol>
            {cycles.map((cycle) => (
              <li className={cycle.current ? "current" : undefined} key={cycle.number}>
                <span>
                  Cycle {cycle.number}
                  {cycle.current ? " · en cours" : ""}
                </span>
                <small>
                  {shortDate(cycle.start)} – {shortDate(cycle.end)}
                </small>
                <strong>{cycle.theme}</strong>
                <small>{cycle.intent}</small>
                <small>En soutien : {cycle.supportTheme}</small>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p>
          <Link href="/diagnostic">Fais ton diagnostic</Link> pour obtenir le plan de ta saison.
        </p>
      )}
    </section>
  );
}
