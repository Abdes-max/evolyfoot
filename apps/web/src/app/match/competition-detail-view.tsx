"use client";

import Link from "next/link";
import { PlaceInput } from "../place-input";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { concernedPlayers, convocationFeedback, type AttendanceEntry, type PlayerSelection } from "@evolyfoot/domain";
import { parseDateInputValue } from "../date-format";
import { ConcernedPlayersPicker, type ConcernedPlayer } from "../concerned-players-picker";
import { TrainingResponses } from "../training-responses";

interface Competition {
  id: string;
  name: string;
  dateLabel: string;
  date: string | null;
  location: string | null;
  description: string | null;
  result: string | null;
  // Joueurs concernés (`null` = tout l'effectif), convocation et réponses.
  selectedPlayerIds: string[] | null;
  convokedAt: string | null;
  attendance?: AttendanceEntry[];
}

interface CompetitionDetailViewProps {
  competitionId: string;
  // Endpoint REST : `${endpoint}/:id` pour GET, `${endpoint}/:id/details` pour PATCH,
  // `${endpoint}/:id` pour DELETE -- même principe que CompetitionsPanel.
  endpoint: string;
  itemKey: string;
  singular: string;
  backHref: string;
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : "Une erreur est survenue.";
}

// Fiche détail d'un tournoi ou d'un plateau -- même forme que la préparation d'un match
// (match-prep-view.tsx) : en-tête avec statut, panneau « Détails » modifiable (date, lieu,
// description, bilan), joueurs concernés, convocation et réponses. Pas de composition : un
// tournoi/plateau n'a pas de feuille de match individuelle rattachée.
export function CompetitionDetailView({ competitionId, endpoint, itemKey, singular, backHref }: CompetitionDetailViewProps) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | undefined>(undefined);
  const [item, setItem] = useState<Competition | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [roster, setRoster] = useState<ConcernedPlayer[]>([]);
  const [selection, setSelection] = useState<PlayerSelection>(null);
  const [convoking, setConvoking] = useState(false);
  const [convocationStatus, setConvocationStatus] = useState<string | null>(null);

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

        const [response, rosterResponse] = await Promise.all([fetch(`${endpoint}/${competitionId}`), fetch("/api/roster")]);
        if (!response.ok) {
          setLoadError(await readErrorMessage(response));
          return;
        }
        const body = await response.json();
        const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
        const loaded: Competition = body[itemKey];
        if (cancelled) {
          return;
        }
        setItem(loaded);
        setRoster(rosterBody.players ?? []);
        setSelection(loaded.selectedPlayerIds ?? null);
        setDateInput(loaded.date ? loaded.date.slice(0, 10) : "");
        setLocation(loaded.location ?? "");
        setDescription(loaded.description ?? "");
        setResult(loaded.result ?? "");
      } catch {
        if (!cancelled) {
          setLoadError("Une erreur est survenue.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [competitionId, endpoint, itemKey]);

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const date = parseDateInputValue(dateInput);
      const response = await fetch(`${endpoint}/${competitionId}/details`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: date ? date.toISOString() : null,
          location,
          description,
          result,
          selectedPlayerIds: selection,
        }),
      });
      if (!response.ok) {
        setSaveError(await readErrorMessage(response));
        return;
      }
      const body = await response.json();
      const updated: Competition = body[itemKey];
      setItem(updated);
      setSelection(updated.selectedPlayerIds ?? null);
      setDateInput(updated.date ? updated.date.slice(0, 10) : "");
    } catch {
      setSaveError("Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  // Convocation aux joueurs concernés (messagerie + e-mail) ; ouvre les réponses côté joueur.
  async function convoke() {
    setConvoking(true);
    setConvocationStatus(null);
    try {
      const response = await fetch(`${endpoint}/${competitionId}/convoke`, { method: "POST" });
      if (!response.ok) {
        setConvocationStatus(await readErrorMessage(response));
        return;
      }
      const body = await response.json();
      setConvocationStatus(convocationFeedback(body.sentCount, body.emailCount));
      const refreshed = await fetch(`${endpoint}/${competitionId}`);
      const refreshedBody = refreshed.ok ? await refreshed.json().catch(() => null) : null;
      if (refreshedBody?.[itemKey]) {
        setItem(refreshedBody[itemKey]);
      }
    } catch {
      setConvocationStatus("Une erreur est survenue.");
    } finally {
      setConvoking(false);
    }
  }

  async function remove() {
    setRemoving(true);
    try {
      await fetch(`${endpoint}/${competitionId}`, { method: "DELETE" });
      router.push(backHref);
    } catch {
      setSaveError("Une erreur est survenue.");
      setRemoving(false);
    }
  }

  if (authenticated === false) {
    return (
      <main className="match-shell">
        <section className="match-auth-required" role="status">
          <p>
            Connecte-toi pour voir ce {singular}.{" "}
            <Link className="inline-cta" href="/connexion">
              Se connecter →
            </Link>
          </p>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="match-shell">
        <section className="match-content">
          <p className="field-error" role="alert">
            {loadError}
          </p>
          <Link className="back-link" href={backHref}>
            Retour
          </Link>
        </section>
      </main>
    );
  }

  if (!item) {
    return <main className="match-shell" />;
  }

  const isPast = item.date ? new Date(item.date).getTime() < new Date().getTime() : false;

  return (
    <main className="match-shell">
      <header className="page-header match-header">
        <div>
          <span className="eyebrow light">{isPast ? `${singular.toUpperCase()} PASSÉ` : `${singular.toUpperCase()} À VENIR`}</span>
          <h1 title={item.name}>{item.name}</h1>
          <p title={item.dateLabel}>{item.dateLabel}</p>
        </div>
      </header>

      <section className="match-content">
        <div className="match-slot-panel">
          <form className="match-details-form" onSubmit={saveDetails}>
            <h2>Détails</h2>
            <label>
              <span>Date</span>
              <input onChange={(event) => setDateInput(event.target.value)} type="date" value={dateInput} />
            </label>
            <label>
              <span>Lieu</span>
              <PlaceInput onChange={setLocation} value={location} />
            </label>
            <label>
              <span>Description</span>
              <textarea onChange={(event) => setDescription(event.target.value)} value={description} />
            </label>
            <label>
              <span>Bilan</span>
              <input onChange={(event) => setResult(event.target.value)} placeholder="Ex. 2 victoires, 1 nul" value={result} />
            </label>
            <ConcernedPlayersPicker
              hint={`Seuls les joueurs cochés voient ce ${singular}, reçoivent la convocation et peuvent répondre.`}
              onChange={setSelection}
              roster={roster}
              value={selection}
            />
            <button className="match-details-save" disabled={saving || selection?.length === 0} type="submit">
              {saving ? "Enregistrement…" : "Enregistrer les détails"}
            </button>
          </form>

          <TrainingResponses
            attendance={item.attendance}
            convokedAt={item.convokedAt}
            meetingAt={item.date}
            roster={concernedPlayers(roster, item.selectedPlayerIds ?? null)}
            scheduledText={`Les joueurs concernés voient ce ${singular} sans pouvoir répondre tant que tu n’as pas envoyé la convocation.`}
            settings={null}
          />
          {!isPast && (
            <div className="match-convocation">
              <button className="match-convocation-send" disabled={convoking} onClick={convoke} type="button">
                {convoking ? "Envoi…" : item.convokedAt ? "Renvoyer la convocation" : "Envoyer la convocation"}
              </button>
              {convocationStatus && <p className="match-convocation-feedback">{convocationStatus}</p>}
            </div>
          )}

          {saveError && (
            <p className="field-error" role="alert">
              {saveError}
            </p>
          )}

          <button className="competition-detail-remove" disabled={removing} onClick={remove} type="button">
            {removing ? "…" : `Retirer ce ${singular}`}
          </button>
        </div>
      </section>

      <Link className="back-link match-back-link" href={backHref}>
        Retour aux matchs
      </Link>
    </main>
  );
}
