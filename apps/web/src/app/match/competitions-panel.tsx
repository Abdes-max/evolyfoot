"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { frenchDateLabel, parseDateInputValue, sortChronologically } from "../date-format";
import type { AttendanceEntry, MatchScope, PlayerSelection } from "@evolyfoot/domain";
import { ConcernedPlayersPicker, type ConcernedPlayer } from "../concerned-players-picker";
import { ConvocationSummary } from "../convocation-summary";
import { CalendarIcon, PinIcon } from "../icons";
import { PlaceInput } from "../place-input";

interface Competition {
  id: string;
  name: string;
  dateLabel: string;
  date: string | null;
  location?: string | null;
  result: string | null;
  finishedAt?: string | null;
  cancelledAt?: string | null;
  convokedAt?: string | null;
  attendance?: AttendanceEntry[];
  selectedPlayerIds?: PlayerSelection;
}

interface CompetitionsPanelProps {
  // Libellé de la section et intitulé au singulier (pour les placeholders / aria-label).
  title: string;
  singular: string;
  // Endpoint REST : `${endpoint}` pour GET/POST, `${endpoint}/:id` pour DELETE.
  endpoint: string;
  // Clés de la réponse JSON : liste et élément unique.
  listKey: string;
  itemKey: string;
  // Base de la fiche détail cliquable (voir competition-detail-view.tsx), même forme qu'un match
  // (/match/:id) : `${detailBasePath}/${item.id}`.
  detailBasePath: string;
  // N'affiche que les fiches à venir ou passées (l'ajout reste toujours possible).
  scope?: MatchScope;
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : "Une erreur est survenue.";
}

// Passé : marqué terminé, ou jour dépassé (la date ne porte que le jour, enregistrée à minuit UTC).
function isPastCompetition(item: { date: string | null; finishedAt?: string | null }, now = new Date()): boolean {
  if (item.finishedAt) return true;
  return item.date ? new Date(item.date).getTime() < Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) : false;
}

export function CompetitionsPanel({ title, singular, endpoint, listKey, itemKey, detailBasePath, scope }: CompetitionsPanelProps) {
  const [items, setItems] = useState<Competition[]>([]);
  const [name, setName] = useState("");
  // "YYYY-MM-DD" (valeur brute d'un <input type="date">) -- dateLabel en dérive automatiquement
  // à l'envoi, voir add() ci-dessous.
  const [dateInput, setDateInput] = useState("");
  const [result, setResult] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  // Formulaire d'ajout replié derrière « + Ajouter », comme dans l'app Coach.
  const [formOpen, setFormOpen] = useState(false);
  const [roster, setRoster] = useState<ConcernedPlayer[]>([]);
  // Joueurs concernés, tout l'effectif par défaut (voir ConcernedPlayersPicker).
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<PlayerSelection>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [response, rosterResponse] = await Promise.all([fetch(endpoint), fetch("/api/roster")]);
        const body = await response.json().catch(() => ({}));
        const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
        if (!cancelled && response.ok) {
          setItems(body[listKey] ?? []);
          setRoster(rosterBody.players ?? []);
        }
      } catch {
        // Section vide si la liste ne charge pas.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endpoint, listKey]);

  async function add(event: FormEvent) {
    event.preventDefault();
    setAdding(true);
    setError("");
    try {
      const date = parseDateInputValue(dateInput);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          dateLabel: date ? frenchDateLabel(date) : dateInput,
          date: date ? date.toISOString() : null,
          location: location.trim() || undefined,
          result: result || undefined,
          selectedPlayerIds,
        }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const body = await response.json();
      setItems((current) => [body[itemKey], ...current]);
      setName("");
      setDateInput("");
      setResult("");
      setLocation("");
      setSelectedPlayerIds(null);
      setFormOpen(false);
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setAdding(false);
    }
  }

  // À venir : les plus proches d'abord ; passés : les plus récents d'abord.
  const sorted = sortChronologically(items, (item) => (item.date ? new Date(item.date) : null));
  const visible = scope
    ? scope === "past"
      ? sorted.filter((item) => isPastCompetition(item)).reverse()
      : sorted.filter((item) => !isPastCompetition(item))
    : sorted;

  return (
    <section className="competitions-panel" aria-labelledby={`competitions-${listKey}`}>
      <div className="competitions-head">
        <h2 id={`competitions-${listKey}`}>{title}</h2>
        {!formOpen && (
          <button aria-label={`Ajouter un ${singular}`} className="competitions-add" onClick={() => setFormOpen(true)} type="button">
            + Ajouter
          </button>
        )}
      </div>
      {formOpen && (
        <form className="competitions-form" onSubmit={add}>
          <input onChange={(event) => setName(event.target.value)} placeholder={`Nom du ${singular}`} value={name} />
          <input aria-label="Date" onChange={(event) => setDateInput(event.target.value)} required type="date" value={dateInput} />
          <input onChange={(event) => setResult(event.target.value)} placeholder="Bilan (optionnel)" value={result} />
          <div className="competitions-form-place">
            <PlaceInput onChange={setLocation} value={location} />
          </div>
          <div className="competitions-form-players">
            <ConcernedPlayersPicker
              hint="Seuls les joueurs cochés voient l’événement, reçoivent la convocation et peuvent répondre."
              onChange={setSelectedPlayerIds}
              roster={roster}
              value={selectedPlayerIds}
            />
          </div>
          <div className="competitions-form-actions">
            <button disabled={adding || selectedPlayerIds?.length === 0} type="submit">
              {adding ? "Ajout…" : "Ajouter"}
            </button>
            <button className="secondary" onClick={() => setFormOpen(false)} type="button">
              Annuler
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {visible.length === 0 ? (
        <p className="competitions-empty">
          {scope === "past" ? `Aucun ${singular} passé.` : scope === "upcoming" ? `Aucun ${singular} à venir.` : `Aucun ${singular} pour l’instant.`}
        </p>
      ) : (
        // Même forme qu'un match (match-list-view.tsx) : une carte cliquable menant à la fiche
        // détail (competition-detail-view.tsx), plutôt qu'une simple ligne avec un bouton
        // "Retirer" -- la suppression se fait désormais depuis la fiche détail.
        <ul className="match-list competitions-list" aria-label={title}>
          {visible.map((item) => {
            const isPast = isPastCompetition(item);
            return (
              <li key={item.id}>
                <Link aria-label={`${item.name} — Voir le détail`} className="match-card card-link" href={`${detailBasePath}/${item.id}`}>
                  <div className="match-card-top">
                    <span className={`match-status ${isPast ? "match-status-played" : "match-status-scheduled"}${item.cancelledAt ? " status-cancelled" : ""}`}>
                      {item.cancelledAt ? "Annulé" : item.finishedAt ? "Terminé" : isPast ? "Passé" : "À venir"}
                    </span>
                  </div>
                  <h2 aria-hidden="true">{item.name}</h2>
                  <p aria-hidden="true" className="match-card-meta">
                    <CalendarIcon />
                    {item.dateLabel}
                  </p>
                  {item.location && (
                    <p aria-hidden="true" className="match-card-meta">
                      <PinIcon />
                      {item.location}
                    </p>
                  )}
                  {item.result && <p aria-hidden="true">{item.result}</p>}
                  {(!isPast || item.convokedAt) && !item.cancelledAt && (
                    <ConvocationSummary attendance={item.attendance} convokedAt={item.convokedAt} roster={roster} selectedPlayerIds={item.selectedPlayerIds} />
                  )}
                  {!item.cancelledAt && (
                    <span aria-hidden="true" className="match-card-link card-cta">
                      Voir le détail →
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
