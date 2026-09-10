"use client";

import type { TrainingSession } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cycleWeekLabel } from "../cycle";
import { rehydrateTrainingSession, type SavedTrainingSession } from "../rehydrate";
import { SessionBuilder } from "../session-builder";

interface RosterPlayer {
  id: string;
  name: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "stale" }
  | { status: "ready"; session: TrainingSession; weekNumber: number; slot: number };

export function SavedSessionView({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
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
        if (!sessionBody.educator) {
          setState({ status: "not-found" });
          return;
        }
        setAuthenticated(true);

        const [recordResponse, rosterResponse] = await Promise.all([
          fetch(`/api/sessions/${sessionId}`),
          fetch("/api/roster"),
        ]);
        if (cancelled) {
          return;
        }
        if (recordResponse.status === 404) {
          setState({ status: "not-found" });
          return;
        }
        const recordBody = await recordResponse.json().catch(() => ({ session: null }));
        const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
        const record: SavedTrainingSession | null = recordBody.session ?? null;
        if (!record) {
          setState({ status: "not-found" });
          return;
        }

        const rehydrated = rehydrateTrainingSession(record);
        if (!rehydrated) {
          setState({ status: "stale" });
          return;
        }
        setRoster(rosterBody.players ?? []);
        setState({ status: "ready", session: rehydrated, weekNumber: record.weekNumber, slot: record.slot });
      } catch {
        if (!cancelled) {
          setState({ status: "not-found" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <main className="session-shell">
      <header className="session-header">
        <Link className="onboarding-brand" href="/">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        {state.status === "ready" ? (
          <>
            <span className="eyebrow light">
              {cycleWeekLabel(state.weekNumber)} · Séance {state.slot + 1}
            </span>
            <h1>Ajuste ta séance.</h1>
            <p>{state.session.intention}</p>
          </>
        ) : (
          <>
            <span className="eyebrow light">Séance</span>
            <h1>Séance</h1>
          </>
        )}
      </header>

      {state.status === "loading" && <p className="session-loading">Chargement de la séance…</p>}

      {state.status === "not-found" && (
        <section className="session-missing">
          <p>Cette séance est introuvable.</p>
          <Link className="back-link" href="/seances">
            Retour à mes séances
          </Link>
        </section>
      )}

      {state.status === "stale" && (
        <section className="session-missing">
          <p>Cette séance a été enregistrée avec des situations qui ne sont plus au catalogue. Génère-la à nouveau depuis la page Séances.</p>
          <Link className="back-link" href="/seances">
            Retour à mes séances
          </Link>
        </section>
      )}

      {state.status === "ready" && (
        <SessionBuilder
          authenticated={authenticated}
          mode="edit"
          onChange={(session) => setState({ ...state, session })}
          roster={roster}
          session={state.session}
          slot={state.slot}
          weekNumber={state.weekNumber}
        />
      )}
    </main>
  );
}
