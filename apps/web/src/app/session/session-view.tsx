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
import { SessionBuilder } from "./session-builder";

// Diagnostic et équipe de démonstration, utilisés tant qu'aucune donnée réelle n'est disponible
// (visiteur anonyme, ou éducateur connecté n'ayant pas encore fait son diagnostic ou son équipe).
const demoScores: DiagnosticScores = { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 };

function buildInitialSession(scores: DiagnosticScores, ageGroup: AgeGroup, playerCount: number): TrainingSession {
  const plan = buildDevelopmentPlan(summarizeDiagnostic(scores));
  return generateTrainingSession(plan.weeks[0], ageGroup, playerCount);
}

export function SessionView() {
  const [session, setSession] = useState<TrainingSession>(() =>
    buildInitialSession(demoScores, demoTeam.ageGroup, demoTeam.playerCount),
  );
  const [authenticated, setAuthenticated] = useState(false);

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

        const [teamResponse, diagnosticResponse] = await Promise.all([fetch("/api/team"), fetch("/api/diagnostic")]);
        const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
        const diagnosticBody = await diagnosticResponse.json().catch(() => ({ scores: null }));
        if (cancelled) {
          return;
        }

        const ageGroup: AgeGroup = teamBody.profile?.ageGroup ?? demoTeam.ageGroup;
        const playerCount: number = teamBody.profile?.playerCount ?? demoTeam.playerCount;
        const scores: DiagnosticScores = diagnosticBody.scores ?? demoScores;
        setSession(buildInitialSession(scores, ageGroup, playerCount));
      } catch {
        // Reste sur la séance de démonstration.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="session-shell">
      <header className="session-header">
        <Link className="onboarding-brand" href="/">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <span className="eyebrow light">SÉANCE 1 · SEMAINE 1</span>
        <h1>Prépare ta première séance.</h1>
        <p>{session.intention}</p>
      </header>
      <SessionBuilder authenticated={authenticated} onChange={setSession} session={session} />
    </main>
  );
}
