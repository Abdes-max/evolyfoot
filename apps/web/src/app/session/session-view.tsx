"use client";

import {
  buildDevelopmentPlan,
  demoTeam,
  generateTrainingSession,
  summarizeDiagnostic,
  type AgeGroup,
  type DiagnosticScores,
  type TrainingSession,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cycleWeekLabel } from "./cycle";
import { SessionBuilder } from "./session-builder";

// Diagnostic et équipe de démonstration, utilisés tant qu'aucune donnée réelle n'est disponible
// (visiteur anonyme, ou éducateur connecté n'ayant pas encore fait son diagnostic ou son équipe).
const demoScores: DiagnosticScores = { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 };

function buildSessionForWeek(
  scores: DiagnosticScores,
  ageGroup: AgeGroup,
  playerCount: number,
  weekNumber: number,
): TrainingSession {
  const plan = buildDevelopmentPlan(summarizeDiagnostic(scores));
  const week = plan.weeks[weekNumber - 1] ?? plan.weeks[0]!;
  return generateTrainingSession(week, ageGroup, playerCount);
}

interface RosterPlayer {
  id: string;
  name: string;
}

interface SessionViewProps {
  weekNumber: number;
  slot: number;
}

export function SessionView({ weekNumber, slot }: SessionViewProps) {
  const [session, setSession] = useState<TrainingSession>(() =>
    buildSessionForWeek(demoScores, demoTeam.ageGroup, demoTeam.playerCount, weekNumber),
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);

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

        const [teamResponse, diagnosticResponse, rosterResponse] = await Promise.all([
          fetch("/api/team"),
          fetch("/api/diagnostic"),
          fetch("/api/roster"),
        ]);
        const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
        const diagnosticBody = await diagnosticResponse.json().catch(() => ({ scores: null }));
        const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
        if (cancelled) {
          return;
        }

        const ageGroup: AgeGroup = teamBody.profile?.ageGroup ?? demoTeam.ageGroup;
        const playerCount: number = teamBody.profile?.playerCount ?? demoTeam.playerCount;
        const scores: DiagnosticScores = diagnosticBody.scores ?? demoScores;
        setSession(buildSessionForWeek(scores, ageGroup, playerCount, weekNumber));
        setRoster(rosterBody.players ?? []);
      } catch {
        // Reste sur la séance de démonstration.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [weekNumber]);

  return (
    <main className="session-shell">
      <header className="session-header">
        <Link className="onboarding-brand" href="/app">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <span className="eyebrow light">
          {cycleWeekLabel(weekNumber)} · Séance {slot + 1}
        </span>
        <h1>Prépare ta séance.</h1>
        <p>{session.intention}</p>
      </header>
      <SessionBuilder
        authenticated={authenticated}
        onChange={setSession}
        roster={roster}
        session={session}
        slot={slot}
        weekNumber={weekNumber}
      />
    </main>
  );
}
