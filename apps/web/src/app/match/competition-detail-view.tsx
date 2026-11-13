"use client";

import Link from "next/link";
import { PlaceInput } from "../place-input";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  competitionRecordLabel,
  concernedPlayers,
  type AttendanceEntry,
  type CompetitionGame,
  type CompetitionLineup,
  type GameFormat,
  type PlayerSelection,
} from "@evolyfoot/domain";
import { parseDateInputValue } from "../date-format";
import { ConcernedPlayersPicker, type ConcernedPlayer } from "../concerned-players-picker";
import { CancelEventPanel, CancelledBanner } from "../cancel-event-panel";
import { selectionSummary } from "../selection-summary";
import { CollapsibleSection } from "../collapsible-section";
import { ConvocationActions } from "../convocation-actions";
import { CompetitionGames } from "./competition-games";
import { CompetitionLineupEditor } from "./competition-lineup";

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
  games?: CompetitionGame[];
  lineup?: CompetitionLineup | null;
  // Date où il a été marqué terminé, `null` tant qu'il est en cours.
  finishedAt?: string | null;
  // Annulé par le coach (ISO) et la raison communiquée aux joueurs.
  cancelledAt?: string | null;
  cancellationNote?: string | null;
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

// Fiche détail d'un tournoi ou d'un plateau, dans le même ordre que l'app Coach : détails (date,
// lieu, description, bilan, joueurs concernés repliés), convocation et réponses, composition et
// rencontres repliées, puis terminer/rouvrir et retirer.
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
  const [roster, setRoster] = useState<Array<ConcernedPlayer & { position?: string | null; jerseyNumber?: string | null; photo?: string | null }>>([]);
  const [teamGameFormat, setTeamGameFormat] = useState<GameFormat>(8);
  const [teamLineup, setTeamLineup] = useState<CompetitionLineup | null>(null);
  const [selection, setSelection] = useState<PlayerSelection>(null);
  const [savingSelection, setSavingSelection] = useState(false);
  const [selectionFeedback, setSelectionFeedback] = useState("");
  // Remonte l'éditeur de compo quand le serveur l'a restreinte aux joueurs concernés.
  const [lineupVersion, setLineupVersion] = useState(0);

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

        const [response, rosterResponse, teamResponse, teamLineupResponse] = await Promise.all([
          fetch(`${endpoint}/${competitionId}`),
          fetch("/api/roster"),
          fetch("/api/team"),
          fetch("/api/team/lineup"),
        ]);
        if (!response.ok) {
          setLoadError(await readErrorMessage(response));
          return;
        }
        const body = await response.json();
        const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
        const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
        const teamLineupBody = teamLineupResponse.ok ? await teamLineupResponse.json().catch(() => null) : null;
        const loaded: Competition = body[itemKey];
        if (cancelled) {
          return;
        }
        setItem(loaded);
        setRoster(rosterBody.players ?? []);
        if (typeof teamBody.profile?.gameFormat === "number") setTeamGameFormat(teamBody.profile.gameFormat as GameFormat);
        setTeamLineup(teamLineupBody?.lineup ?? null);
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
        }),
      });
      if (!response.ok) {
        setSaveError(await readErrorMessage(response));
        return;
      }
      const body = await response.json();
      const updated: Competition = body[itemKey];
      setItem(updated);
      setDateInput(updated.date ? updated.date.slice(0, 10) : "");
    } catch {
      setSaveError("Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  // Joueurs concernés : même section que la fiche match. La compo et les rencontres suivent la sélection
  // enregistrée (un joueur décoché quitte la composition).
  async function saveSelection() {
    setSavingSelection(true);
    setSelectionFeedback("");
    try {
      const response = await fetch(`${endpoint}/${competitionId}/details`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selectedPlayerIds: selection }),
      });
      if (!response.ok) {
        setSelectionFeedback(await readErrorMessage(response));
        return;
      }
      const updated: Competition = (await response.json())[itemKey];
      setItem(updated);
      setSelection(updated.selectedPlayerIds ?? null);
      setLineupVersion((version) => version + 1);
      setSelectionFeedback("Joueurs concernés enregistrés.");
    } catch {
      setSelectionFeedback("Une erreur est survenue.");
    } finally {
      setSavingSelection(false);
    }
  }

  // Relit la fiche après l'envoi d'une convocation : date d'envoi et réponses.
  async function refresh() {
    const refreshed = await fetch(`${endpoint}/${competitionId}`).catch(() => null);
    const refreshedBody = refreshed?.ok ? await refreshed.json().catch(() => null) : null;
    if (refreshedBody?.[itemKey]) {
      setItem(refreshedBody[itemKey]);
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

  // Marque la fiche comme terminée, ou la rouvre : une fiche terminée passe dans « Passés » même avant sa date.
  async function toggleFinished() {
    if (!item) return;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch(`${endpoint}/${competitionId}/details`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ finished: !item.finishedAt }),
      });
      if (!response.ok) {
        setSaveError(await readErrorMessage(response));
        return;
      }
      setItem((await response.json())[itemKey]);
    } catch {
      setSaveError("Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  if (!item) {
    return <main className="match-shell" />;
  }

  // Annulé : tout est bloqué sauf « Rétablir » (carte Convocation) et « Retirer ».
  const cancelled = Boolean(item.cancelledAt);
  const isPast = Boolean(item.finishedAt) || (item.date ? new Date(item.date).getTime() < new Date().getTime() : false);

  return (
    <main className="match-shell">
      <header className="page-header match-header">
        <div>
          <span className="eyebrow light">
            {item.cancelledAt
              ? singular.toUpperCase()
              : item.finishedAt
                ? `${singular.toUpperCase()} TERMINÉ`
                : isPast
                  ? `${singular.toUpperCase()} PASSÉ`
                  : `${singular.toUpperCase()} À VENIR`}
          </span>
          <h1 title={item.name}>{item.name}</h1>
          <p title={item.dateLabel}>{item.dateLabel}</p>
        </div>
      </header>

      <section className="match-content event-sheet">
        {item.cancelledAt && <CancelledBanner note={item.cancellationNote} />}
        <form className="event-card match-details-form" onSubmit={saveDetails}>
          <h2>Détails</h2>
          <label>
            <span>Date</span>
            <input disabled={cancelled} onChange={(event) => setDateInput(event.target.value)} type="date" value={dateInput} />
          </label>
          <label>
            <span>Lieu</span>
            <PlaceInput disabled={cancelled} onChange={setLocation} value={location} />
          </label>
          <label>
            <span>Description</span>
            <textarea disabled={cancelled} onChange={(event) => setDescription(event.target.value)} value={description} />
          </label>
          <label>
            <span>Bilan</span>
            <input disabled={cancelled} onChange={(event) => setResult(event.target.value)} placeholder="Ex. 2 victoires, 1 nul" value={result} />
          </label>
          {saveError && (
            <p className="field-error" role="alert">
              {saveError}
            </p>
          )}
          {!cancelled && (
            <button className="match-convocation-send" disabled={saving} type="submit">
              {saving ? "Enregistrement…" : "Enregistrer les détails"}
            </button>
          )}
        </form>

        {!cancelled && (
          <CollapsibleSection summary={selectionSummary(item.selectedPlayerIds ?? null, roster.length)} title="Joueurs concernés">
            <ConcernedPlayersPicker
              hint={`Seuls les joueurs cochés voient ce ${singular}, reçoivent la convocation et entrent dans la composition et les rencontres.`}
              onChange={(value) => {
                setSelection(value);
                setSelectionFeedback("");
              }}
              roster={roster}
              value={selection}
            />
            {JSON.stringify(selection) !== JSON.stringify(item.selectedPlayerIds ?? null) && (
              <button className="match-details-save" disabled={savingSelection || selection?.length === 0} onClick={saveSelection} type="button">
                {savingSelection ? "Enregistrement…" : "Enregistrer les joueurs concernés"}
              </button>
            )}
            {selectionFeedback && <p className="match-convocation-feedback">{selectionFeedback}</p>}
          </CollapsibleSection>
        )}

        <div className="event-card">
          <h2>{cancelled ? "Annulation" : "Convocation"}</h2>
          {/* Annulé : ni convocation, ni présents / absents. */}
          {!cancelled && (
            <ConvocationActions
              attendance={item.attendance}
              canSend={!isPast && !item.cancelledAt}
              convokeUrl={`${endpoint}/${competitionId}/convoke`}
              convokedAt={item.convokedAt}
              meetingAt={item.date}
              onSent={refresh}
              roster={roster}
              scheduledText={`Les joueurs concernés voient ce ${singular} sans pouvoir répondre tant que tu n’as pas envoyé la convocation.`}
              selectedPlayerIds={item.selectedPlayerIds}
            />
          )}
          <CancelEventPanel
            cancellationNote={item.cancellationNote}
            cancelledAt={item.cancelledAt}
            hideState
            noun={`ce ${singular}`}
            onChange={(state) => setItem((current) => (current ? { ...current, ...state } : current))}
            url={`${endpoint}/${competitionId}/cancel`}
          />
        </div>

        {!cancelled && (
          <CollapsibleSection
            summary={item.lineup?.lineup.length ? `${item.lineup.lineup.length} titulaires · foot à ${item.lineup.gameFormat}` : "Facultative"}
            title="Composition"
          >
            <CompetitionLineupEditor
              defaultGameFormat={teamGameFormat}
              initial={item.lineup ?? null}
              key={`${item.id}-${lineupVersion}`}
              lineupUrl={`${endpoint}/${competitionId}/lineup`}
              players={roster.filter(
                (player) =>
                  concernedPlayers([player], item.selectedPlayerIds ?? null).length > 0 ||
                  item.lineup?.lineup.some((assignment) => assignment.playerId === player.id) ||
                  item.lineup?.substitutePlayerIds.includes(player.id),
              )}
              readOnly={Boolean(item.finishedAt || item.cancelledAt)}
              template={teamLineup}
            />
          </CollapsibleSection>
        )}

        {!cancelled && (
          <CollapsibleSection summary={competitionRecordLabel(item.games ?? []) || "Aucune rencontre saisie"} title="Rencontres et scores">
            <p className="match-slot-hint event-hint">Une ligne par rencontre jouée : équipe rencontrée, score, buteurs et passeurs décisifs.</p>
            {item.cancelledAt ? (
              <p className="match-slot-hint">{`Ce ${singular} est annulé : rétablis-le pour saisir les rencontres.`}</p>
            ) : (
              <CompetitionGames
                games={item.games ?? []}
                gamesUrl={`${endpoint}/${competitionId}/games`}
                key={item.id}
                onSaved={(games) => setItem((current) => (current ? { ...current, games } : current))}
                players={concernedPlayers(roster, item.selectedPlayerIds ?? null)}
              />
            )}
          </CollapsibleSection>
        )}

        {!cancelled && (
          <button className="match-convocation-send event-wide" disabled={saving} onClick={toggleFinished} type="button">
            {item.finishedAt ? `Rouvrir ce ${singular}` : `Marquer ce ${singular} comme terminé`}
          </button>
        )}

        <button className="competition-detail-remove event-wide" disabled={removing} onClick={remove} type="button">
          {removing ? "…" : `Retirer ce ${singular}`}
        </button>
      </section>

      <Link className="back-link match-back-link" href={backHref}>
        Retour aux matchs
      </Link>
    </main>
  );
}
