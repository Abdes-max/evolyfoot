"use client";

import { fixtureFromTitle, parseCalendarFile, type GameFormat, type MatchVenue } from "@evolyfoot/domain";
import { useRef, useState, type ChangeEvent } from "react";
import { frenchDateLabel } from "../date-format";

interface Candidate {
  key: string;
  opponent: string;
  venue: MatchVenue;
  date: Date | null;
  location: string | null;
  duplicate: boolean;
  selected: boolean;
}

interface CalendarImportProps<CreatedMatch> {
  teamName: string;
  gameFormat: GameFormat;
  formationId: string;
  existing: ReadonlyArray<{ opponent: string; date: string | null }>;
  onImported: (matches: readonly CreatedMatch[]) => void;
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function CalendarImport<CreatedMatch>({ teamName, gameFormat, formationId, existing, onImported }: CalendarImportProps<CreatedMatch>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setMessage("");
    const now = Date.now();
    const events = parseCalendarFile(await file.text());
    if (events.length === 0) {
      setCandidates(null);
      setMessage("Aucun événement trouvé dans ce fichier.");
      return;
    }
    setCandidates(
      events.map((calendarEvent, index) => {
        const fixture = fixtureFromTitle(calendarEvent.title, teamName);
        const { date } = calendarEvent;
        const duplicate = existing.some(
          (match) =>
            match.opponent.toLowerCase() === fixture.opponent.toLowerCase() && date !== null && match.date !== null && sameDay(new Date(match.date), date),
        );
        const upcoming = date === null || date.getTime() >= now;
        return { key: `${index}-${calendarEvent.title}`, ...fixture, date, location: calendarEvent.location, duplicate, selected: upcoming && !duplicate };
      }),
    );
  }

  function toggle(key: string) {
    setCandidates((current) => current?.map((candidate) => (candidate.key === key ? { ...candidate, selected: !candidate.selected } : candidate)) ?? null);
  }

  async function importSelected() {
    const selected = candidates?.filter((candidate) => candidate.selected) ?? [];
    setImporting(true);
    setMessage("");
    const created: CreatedMatch[] = [];
    let failed = 0;
    for (const candidate of selected) {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opponent: candidate.opponent,
          dateLabel: candidate.date ? frenchDateLabel(candidate.date) : "Date à préciser",
          date: candidate.date ? candidate.date.toISOString() : null,
          venue: candidate.venue,
          gameFormat,
          formationId,
          ...(candidate.location ? { location: candidate.location } : {}),
        }),
      }).catch(() => null);
      const body = await response?.json().catch(() => null);
      if (response?.ok && body?.match) {
        created.push(body.match as CreatedMatch);
      } else {
        failed += 1;
      }
    }
    setImporting(false);
    onImported(created);
    setCandidates(failed > 0 ? candidates : null);
    setMessage(
      `${created.length} match${created.length > 1 ? "s" : ""} importé${created.length > 1 ? "s" : ""}.${failed > 0 ? ` ${failed} n’ont pas pu être créés.` : ""}`,
    );
  }

  const selectedCount = candidates?.filter((candidate) => candidate.selected).length ?? 0;

  return (
    <section aria-label="Importer un calendrier" className="calendar-import">
      <button className="match-new-button" onClick={() => inputRef.current?.click()} type="button">
        Importer un calendrier (.ics)
      </button>
      <input accept=".ics,text/calendar" aria-label="Fichier de calendrier" className="visually-hidden" onChange={readFile} ref={inputRef} type="file" />
      {message && <p role="status">{message}</p>}

      {candidates && (
        <div className="calendar-import-review">
          <p>Coche les matchs à créer. Les dates passées et les matchs déjà présents sont décochés.</p>
          <ul>
            {candidates.map((candidate) => (
              <li key={candidate.key}>
                <label>
                  <input checked={candidate.selected} onChange={() => toggle(candidate.key)} type="checkbox" />
                  <span>
                    <strong>{candidate.opponent}</strong>
                    <small>
                      {[
                        candidate.date ? frenchDateLabel(candidate.date) : "Date à préciser",
                        candidate.venue === "home" ? "Domicile" : "Extérieur",
                        candidate.location,
                        candidate.duplicate ? "Déjà présent" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="calendar-import-actions">
            <button className="player-primary" disabled={importing || selectedCount === 0} onClick={importSelected} type="button">
              {importing ? "Import…" : `Créer ${selectedCount} match${selectedCount > 1 ? "s" : ""}`}
            </button>
            <button className="player-ghost" onClick={() => setCandidates(null)} type="button">
              Annuler
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
