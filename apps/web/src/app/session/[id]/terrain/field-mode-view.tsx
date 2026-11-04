"use client";

import {
  fieldClock as clock,
  fieldSteps,
  goToFieldStep as goTo,
  nextFieldStep as next,
  rehydrateTrainingSession,
  scoreField as score,
  startField,
  tickField as tick,
  toggleField as toggle,
  type FieldState,
  type SavedTrainingSession,
  type TrainingSession,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { TacticalPlayer } from "../../../tactical-player";

// Écran du bord de terrain : une situation à la fois, gros minuteur, défi entre les deux équipes.
export function FieldModeView({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<TrainingSession | null | undefined>(undefined);
  const steps = useMemo(() => (session ? fieldSteps(session) : []), [session]);
  const [state, setState] = useState<FieldState | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [recordBody, personalBody] = await Promise.all(
        [`/api/sessions/${sessionId}`, "/api/personal-exercises"].map((url) =>
          fetch(url)
            .then((response) => (response.ok ? response.json() : null))
            .catch(() => null),
        ),
      );
      if (cancelled) return;
      const record: SavedTrainingSession | null = recordBody?.session ?? null;
      const rehydrated = record ? rehydrateTrainingSession(record, personalBody?.exercises ?? []) : null;
      setSession(rehydrated);
      if (rehydrated) setState(startField(fieldSteps(rehydrated)));
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!state?.running) return;
    const timer = setInterval(() => setState((current) => (current ? tick(current) : current)), 1000);
    return () => clearInterval(timer);
  }, [state?.running]);

  // Garde l'écran allumé pendant que le minuteur tourne (navigateurs qui le permettent).
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    if (state?.running && nav.wakeLock && !wakeLock.current) {
      nav.wakeLock
        .request("screen")
        .then((lock) => {
          wakeLock.current = lock;
        })
        .catch(() => undefined);
    }
    if (!state?.running && wakeLock.current) {
      wakeLock.current.release().catch(() => undefined);
      wakeLock.current = null;
    }
  }, [state?.running]);

  // Fin de séquence : vibration du téléphone, quand c'est possible.
  const ended = state?.remaining === 0;
  useEffect(() => {
    if (ended) navigator.vibrate?.([300, 150, 300]);
  }, [ended, state?.step, state?.sequence]);

  if (session === undefined) return <p className="session-loading">Chargement de la séance…</p>;
  if (!session || !state) {
    return (
      <section className="session-missing">
        <p>Cette séance est introuvable.</p>
        <Link className="back-link" href="/seances">
          Retour à mes séances
        </Link>
      </section>
    );
  }

  const block = session.blocks[state.step]!;
  const step = steps[state.step]!;
  const last = state.step === steps.length - 1 && state.sequence === step.sequenceCount;

  return (
    <main className="field-mode">
      <header className="field-mode-head">
        <Link href={`/session/${sessionId}`}>← Quitter</Link>
        <span>
          Situation {state.step + 1}/{steps.length}
        </span>
      </header>

      <h1>{block.activity.title}</h1>
      <p className="field-mode-instruction">{block.activity.instruction}</p>

      <div className="field-mode-timer" aria-live="polite">
        <span>
          Séquence {state.sequence}/{step.sequenceCount}
        </span>
        <strong className={ended ? "is-ended" : undefined}>{clock(state.remaining)}</strong>
        {ended && <span>{last ? "Séance terminée, bravo !" : "Séquence terminée"}</span>}
      </div>

      <div className="field-mode-actions">
        {ended ? (
          !last && (
            <button className="primary-button" onClick={() => setState(next(steps, state))} type="button">
              {state.sequence < step.sequenceCount ? "Séquence suivante" : "Situation suivante"}
            </button>
          )
        ) : (
          <button className="primary-button" onClick={() => setState(toggle(state))} type="button">
            {state.running ? "Pause" : "Démarrer"}
          </button>
        )}
      </div>

      <div className="field-mode-score" role="group" aria-label="Défi entre les équipes">
        {(["Équipe A", "Équipe B"] as const).map((team, index) => (
          <div key={team}>
            <span>{team}</span>
            <strong>{state.scores[index]}</strong>
            <button aria-label={`Retirer un point à ${team}`} onClick={() => setState(score(state, index as 0 | 1, -1))} type="button">
              −
            </button>
            <button aria-label={`Ajouter un point à ${team}`} onClick={() => setState(score(state, index as 0 | 1, 1))} type="button">
              +
            </button>
          </div>
        ))}
      </div>

      <details className="field-mode-details">
        <summary>Schéma et règles</summary>
        <TacticalPlayer exercise={block.activity} seed={block.activity.id} />
        <ul>
          {block.activity.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </details>

      <nav className="field-mode-nav">
        <button disabled={state.step === 0} onClick={() => setState(goTo(steps, state.step - 1))} type="button">
          ← Situation précédente
        </button>
        <button disabled={state.step === steps.length - 1} onClick={() => setState(goTo(steps, state.step + 1))} type="button">
          Situation suivante →
        </button>
      </nav>
    </main>
  );
}
