"use client";

import type { TrainingSession } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
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
  // Passé tel quel à <SessionBuilder>, qui porte désormais le seul input du rendez-vous (voir son
  // commentaire) -- ce fichier ne garde que lieu/description dans son propre formulaire "Détails".
  const [recordMeetingAt, setRecordMeetingAt] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [sendingConvocation, setSendingConvocation] = useState(false);
  const [convocationFeedback, setConvocationFeedback] = useState<string | null>(null);

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
        setRecordMeetingAt(record.meetingAt ?? null);
        setLocation(record.location ?? "");
        setDescription(record.description ?? "");
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

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    setSavingDetails(true);
    setDetailsError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/details`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          location: location.trim() ? location.trim() : null,
          description: description.trim() ? description.trim() : null,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setDetailsError(typeof body.error === "string" ? body.error : "Une erreur est survenue.");
        return;
      }
    } catch {
      setDetailsError("Une erreur est survenue.");
    } finally {
      setSavingDetails(false);
    }
  }

  // Envoie un message de convocation (via la messagerie) à tout l'effectif -- une séance n'a pas
  // de composition retenue, voir ConvocationService côté base.
  async function sendConvocation() {
    setSendingConvocation(true);
    setConvocationFeedback(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/convoke`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setConvocationFeedback(typeof body.error === "string" ? body.error : "Une erreur est survenue.");
        return;
      }
      const body = await response.json();
      setConvocationFeedback(`Convocation envoyée à ${body.sentCount} joueur${body.sentCount > 1 ? "s" : ""}.`);
    } catch {
      setConvocationFeedback("Une erreur est survenue.");
    } finally {
      setSendingConvocation(false);
    }
  }

  return (
    <main className="session-shell">
      <header className="session-header">
        <Link className="onboarding-brand" href="/app">
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
        <>
          <SessionBuilder
            authenticated={authenticated}
            meetingAt={recordMeetingAt}
            mode="edit"
            onChange={(session) => setState({ ...state, session })}
            roster={roster}
            session={state.session}
            slot={state.slot}
            weekNumber={state.weekNumber}
          />

          {/* Classes réutilisées de match.css (match-details-form/-save, match-slot-hint) --
              même formulaire que côté match, voir match-prep-view.tsx. Le rendez-vous se règle
              directement dans <SessionBuilder> ci-dessus (voir son commentaire), pas ici. */}
          <form className="match-details-form" onSubmit={saveDetails}>
            <h2>Détails</h2>
            <p className="match-slot-hint">Affichés sur la fiche que voit le joueur/tuteur.</p>
            <label>
              <span>Lieu</span>
              <input
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Ex. Stade Marius Requier, Aix-en-Provence"
                value={location}
              />
            </label>
            <label>
              <span>Description</span>
              <textarea onChange={(event) => setDescription(event.target.value)} value={description} />
            </label>
            {detailsError && (
              <p className="field-error" role="alert">
                {detailsError}
              </p>
            )}
            <button className="match-details-save" disabled={savingDetails} type="submit">
              {savingDetails ? "Enregistrement…" : "Enregistrer les détails"}
            </button>
          </form>

          <div className="match-convocation">
            <button className="match-convocation-send" disabled={sendingConvocation} onClick={sendConvocation} type="button">
              {sendingConvocation ? "Envoi…" : "Envoyer la convocation"}
            </button>
            <p className="match-slot-hint">Envoyée à tout l’effectif -- une séance n’a pas de composition retenue.</p>
            {convocationFeedback && <p className="match-convocation-feedback">{convocationFeedback}</p>}
          </div>
        </>
      )}
    </main>
  );
}
