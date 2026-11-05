"use client";

import {
  convocationFeedback as formatConvocationFeedback,
  guidedSeasonCycle,
  type AttendanceEntry,
  type TrainingConvocationSettings,
  type TrainingSession,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { PlaceInput } from "../../place-input";
import { cycleWeekLabel } from "../cycle";
import type { PersonalExercise } from "@evolyfoot/domain";
import { rehydrateTrainingSession, type SavedTrainingSession } from "../rehydrate";
import { SessionBuilder } from "../session-builder";
import { TrainingResponses } from "../../training-responses";

interface RosterPlayer {
  id: string;
  name: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "stale" }
  | { status: "ready"; session: TrainingSession; weekNumber: number; slot: number; guidedSeason: boolean };

export function SavedSessionView({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [authenticated, setAuthenticated] = useState(false);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  // Passé tel quel à <SessionBuilder>, qui porte désormais le seul input du rendez-vous (voir son
  // commentaire) -- ce fichier ne garde que lieu/description dans son propre formulaire "Détails".
  const [recordMeetingAt, setRecordMeetingAt] = useState<string | null>(null);
  const [personalExercises, setPersonalExercises] = useState<readonly PersonalExercise[]>([]);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  // Valeurs enregistrées : la convocation reprend celles-ci, la saisie est donc enregistrée avant
  // chaque envoi.
  const [savedDetails, setSavedDetails] = useState({ location: "", description: "" });
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [sendingConvocation, setSendingConvocation] = useState(false);
  const [convocationFeedback, setConvocationFeedback] = useState<string | null>(null);
  // Sans lieu, un premier clic prévient ; le second envoie quand même.
  const [confirmingNoLocation, setConfirmingNoLocation] = useState(false);
  // Convocation et réponses des joueurs (voir TrainingResponses).
  const [convokedAt, setConvokedAt] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<readonly AttendanceEntry[] | undefined>(undefined);
  const [convocationSettings, setConvocationSettings] = useState<TrainingConvocationSettings | null>(null);

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

        const [recordResponse, rosterResponse] = await Promise.all([fetch(`/api/sessions/${sessionId}`), fetch("/api/roster")]);
        if (cancelled) {
          return;
        }
        if (recordResponse.status === 404) {
          setState({ status: "not-found" });
          return;
        }
        const personalBody = await fetch("/api/personal-exercises")
          .then((response) => response.json())
          .catch(() => ({ exercises: [] }));
        if (cancelled) {
          return;
        }
        const recordBody = await recordResponse.json().catch(() => ({ session: null }));
        const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
        const record: SavedTrainingSession | null = recordBody.session ?? null;
        if (!record) {
          setState({ status: "not-found" });
          return;
        }

        const rehydrated = rehydrateTrainingSession(record, personalBody.exercises ?? []);
        if (!rehydrated) {
          setState({ status: "stale" });
          return;
        }
        setRoster(rosterBody.players ?? []);
        const recordState = record as SavedTrainingSession & { convokedAt?: string | null; attendance?: readonly AttendanceEntry[] };
        setConvokedAt(recordState.convokedAt ?? null);
        setAttendance(recordState.attendance);
        void fetch("/api/team/convocations")
          .then((response) => (response.ok ? response.json() : null))
          .then((body) => !cancelled && setConvocationSettings(body?.settings ?? null))
          .catch(() => undefined);
        setPersonalExercises(personalBody.exercises ?? []);
        setRecordMeetingAt(record.meetingAt ?? null);
        setLocation(record.location ?? "");
        setSavedDetails({ location: record.location ?? "", description: record.description ?? "" });
        setDescription(record.description ?? "");
        setState({
          status: "ready",
          session: rehydrated,
          weekNumber: record.weekNumber,
          slot: record.slot,
          guidedSeason: record.cycleNumber === guidedSeasonCycle,
        });
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
      setSavedDetails({ location: location.trim(), description: description.trim() });
    } catch {
      setDetailsError("Une erreur est survenue.");
    } finally {
      setSavingDetails(false);
    }
  }

  // Envoie un message de convocation (via la messagerie) à tout l'effectif -- une séance n'a pas
  // de composition retenue, voir ConvocationService côté base.
  async function persistDetails(): Promise<string | null> {
    const next = { location: location.trim(), description: description.trim() };
    if (next.location === savedDetails.location.trim() && next.description === savedDetails.description.trim()) {
      return null;
    }
    const response = await fetch(`/api/sessions/${sessionId}/details`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ location: next.location || null, description: next.description || null }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return typeof body.error === "string" ? body.error : "Le lieu n’a pas été enregistré.";
    }
    setSavedDetails(next);
    return null;
  }

  async function sendConvocation() {
    if (!location.trim() && !confirmingNoLocation) {
      setConfirmingNoLocation(true);
      setConvocationFeedback("Aucun lieu renseigné : ajoutez-le dans « Détails » ou envoyez sans lieu.");
      return;
    }
    setConfirmingNoLocation(false);
    setSendingConvocation(true);
    setConvocationFeedback(null);
    try {
      const detailsFailure = await persistDetails();
      if (detailsFailure) {
        setConvocationFeedback(detailsFailure);
        return;
      }
      const response = await fetch(`/api/sessions/${sessionId}/convoke`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setConvocationFeedback(typeof body.error === "string" ? body.error : "Une erreur est survenue.");
        return;
      }
      const body = await response.json();
      setConvocationFeedback(formatConvocationFeedback(body.sentCount, body.emailCount));
      // Relit la séance : date d'envoi et présences par défaut posées par le serveur.
      const refreshed = await fetch(`/api/sessions/${sessionId}`)
        .then((reply) => reply.json())
        .catch(() => null);
      setConvokedAt(refreshed?.session?.convokedAt ?? new Date().toISOString());
      setAttendance(refreshed?.session?.attendance);
    } catch {
      setConvocationFeedback("Une erreur est survenue.");
    } finally {
      setSendingConvocation(false);
    }
  }

  return (
    <main className="session-shell">
      <header className="session-header">
        <Link className="session-back" href="/seances">
          ← Mes séances
        </Link>
        {state.status === "ready" ? (
          <>
            <span className="eyebrow light">
              {state.guidedSeason ? `Semaine ${state.weekNumber} de la saison` : cycleWeekLabel(state.weekNumber)} · Séance {state.slot + 1}
            </span>
            <h1>Ajuste ta séance.</h1>
            <p>{state.session.intention}</p>
            <Link className="primary-button session-field-link" href={`/session/${sessionId}/terrain`}>
              Lancer le mode terrain
            </Link>
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
            personalExercises={personalExercises}
            roster={roster}
            session={state.session}
            guidedSeason={state.guidedSeason}
            slot={state.slot}
            weekNumber={state.weekNumber}
          />

          {/* Classes réutilisées de match.css (match-details-form/-save, match-slot-hint) --
              même formulaire que côté match, voir match-prep-view.tsx. Le rendez-vous se règle
              directement dans <SessionBuilder> ci-dessus (voir son commentaire), pas ici. */}
          <section className="session-details">
            <form className="match-details-form" onSubmit={saveDetails}>
              <h2>Détails</h2>
              <p className="match-slot-hint">Affichés sur la fiche que voit le joueur/tuteur.</p>
              <label>
                <span>Lieu</span>
                <PlaceInput onChange={setLocation} value={location} />
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

            <TrainingResponses attendance={attendance} convokedAt={convokedAt} meetingAt={recordMeetingAt} roster={roster} settings={convocationSettings} />

            <div className="match-convocation">
              <button className="match-convocation-send" disabled={sendingConvocation} onClick={sendConvocation} type="button">
                {sendingConvocation
                  ? "Envoi…"
                  : confirmingNoLocation && !location.trim()
                    ? "Envoyer sans lieu"
                    : convokedAt
                      ? "Renvoyer la convocation"
                      : "Envoyer la convocation maintenant"}
              </button>
              <p className="match-slot-hint">
                {location.trim() ? `Lieu indiqué : ${location.trim()}.` : "Aucun lieu renseigné : ajoutez-le ci-dessus pour qu’il figure dans la convocation."}{" "}
                Envoyée à tout l’effectif -- une séance n’a pas de composition retenue.
              </p>
              {convocationFeedback && <p className="match-convocation-feedback">{convocationFeedback}</p>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
