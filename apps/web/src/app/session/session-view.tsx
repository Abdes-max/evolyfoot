"use client";

import {
  buildDevelopmentPlan,
  demoTeam,
  explainTrainingSession,
  generateTrainingSession,
  summarizeDiagnostic,
  type AgeGroup,
  type DiagnosticScores,
  type TrainingSession,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { currentCycleWeek, cycleWeekLabel, suggestedMeetingAt } from "./cycle";
import { SessionBuilder } from "./session-builder";

// Diagnostic et équipe de démonstration, utilisés tant qu'aucune donnée réelle n'est disponible
// (visiteur anonyme, ou éducateur connecté n'ayant pas encore fait son diagnostic ou son équipe).
const demoScores: DiagnosticScores = { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 };

function planWeek(scores: DiagnosticScores, weekNumber: number) {
  const plan = buildDevelopmentPlan(summarizeDiagnostic(scores));
  return plan.weeks[weekNumber - 1] ?? plan.weeks[0]!;
}

function buildSessionForWeek(
  scores: DiagnosticScores,
  ageGroup: AgeGroup,
  playerCount: number,
  weekNumber: number,
  slot: number,
  variant = 0,
): TrainingSession {
  return generateTrainingSession(planWeek(scores, weekNumber), ageGroup, playerCount, slot, variant);
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
    buildSessionForWeek(demoScores, demoTeam.ageGroup, demoTeam.playerCount, weekNumber, slot),
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [scores, setScores] = useState<DiagnosticScores>(demoScores);
  const [meetingAt, setMeetingAt] = useState<string | null>(null);
  const [variant, setVariant] = useState(0);
  const explanation = explainTrainingSession(session, planWeek(scores, weekNumber));

  function proposeAnotherSession() {
    const nextVariant = variant + 1;
    setVariant(nextVariant);
    setSession(buildSessionForWeek(scores, session.ageGroup, session.playerCount, weekNumber, slot, nextVariant));
  }

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

        const [teamResponse, diagnosticResponse, rosterResponse, sessionsResponse] = await Promise.all([
          fetch("/api/team"),
          fetch("/api/diagnostic"),
          fetch("/api/roster"),
          fetch("/api/sessions"),
        ]);
        const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
        const diagnosticBody = await diagnosticResponse.json().catch(() => ({ scores: null }));
        const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
        const sessionsBody = await sessionsResponse.json().catch(() => ({ sessions: [] }));
        if (cancelled) {
          return;
        }

        const ageGroup: AgeGroup = teamBody.profile?.ageGroup ?? demoTeam.ageGroup;
        const playerCount: number = teamBody.profile?.playerCount ?? demoTeam.playerCount;
        const savedScores: DiagnosticScores = diagnosticBody.scores ?? demoScores;
        const trainingDays: readonly string[] = teamBody.profile?.trainingDays ?? [];
        const activeWeek = currentCycleWeek(sessionsBody.sessions ?? [], trainingDays.length);
        setScores(savedScores);
        setSession(buildSessionForWeek(savedScores, ageGroup, playerCount, weekNumber, slot));
        setRoster(rosterBody.players ?? []);
        setMeetingAt(suggestedMeetingAt(trainingDays[slot], weekNumber, activeWeek, new Date()));
      } catch {
        // Reste sur la séance de démonstration.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [weekNumber, slot]);

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
      <section aria-labelledby="session-why-title" className="session-why">
        <div>
          <h2 id="session-why-title">Pourquoi cette séance</h2>
          <p>{explanation.summary}</p>
        </div>
        <button onClick={proposeAnotherSession} type="button">
          Proposer une autre séance
        </button>
      </section>
      <SessionBuilder
        authenticated={authenticated}
        blockReasons={explanation.blocks}
        // Le builder ne lit le rendez-vous qu'au montage : la clé le recrée quand la suggestion arrive.
        key={meetingAt ?? "sans-rendez-vous"}
        meetingAt={meetingAt}
        onChange={setSession}
        roster={roster}
        session={session}
        slot={slot}
        weekNumber={weekNumber}
      />
    </main>
  );
}
