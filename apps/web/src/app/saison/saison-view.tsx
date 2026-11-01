"use client";

import { buildSeasonCalendar, type SeasonEventInput, type SeasonEventType } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const typeLabels: Record<SeasonEventType, string> = {
  session: "Séance",
  match: "Match",
  tournament: "Tournoi",
  plateau: "Plateau",
};

function eventHref(event: SeasonEventInput): string {
  if (event.type === "session") return `/session/${event.id}`;
  if (event.type === "match") return `/match/${event.id}`;
  if (event.type === "tournament") return `/match/tournois/${event.id}`;
  return `/match/plateaux/${event.id}`;
}

function monthLabel(year: number, month: number): string {
  const label = new Date(year, month, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
}

async function readList<Item>(url: string, key: string): Promise<Item[]> {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  return response.ok ? (body[key] ?? []) : [];
}

export function SaisonView() {
  const [events, setEvents] = useState<SeasonEventInput[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [sessions, matches, tournaments, plateaux] = await Promise.all([
          readList<{ id: string; title: string; meetingAt: string | null }>("/api/sessions", "sessions"),
          readList<{ id: string; opponent: string; date: string | null }>("/api/matches", "matches"),
          readList<{ id: string; name: string; date: string | null }>("/api/tournaments", "tournaments"),
          readList<{ id: string; name: string; date: string | null }>("/api/plateaux", "plateaux"),
        ]);
        if (cancelled) {
          return;
        }
        setEvents([
          ...sessions.map((session) => ({ id: session.id, type: "session" as const, title: session.title, date: session.meetingAt })),
          ...matches.map((match) => ({ id: match.id, type: "match" as const, title: `Contre ${match.opponent}`, date: match.date })),
          ...tournaments.map((tournament) => ({ id: tournament.id, type: "tournament" as const, title: tournament.name, date: tournament.date })),
          ...plateaux.map((plateau) => ({ id: plateau.id, type: "plateau" as const, title: plateau.name, date: plateau.date })),
        ]);
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const calendar = useMemo(() => buildSeasonCalendar(events, now), [events, now]);

  return (
    <main className="seances-shell">
      <header className="page-header seances-header">
        <div>
          <span className="eyebrow light">{calendar.label}</span>
          <h1 title="Toute ta saison, mois par mois.">Toute ta saison, mois par mois.</h1>
          <p title="Séances, matchs, tournois et plateaux au même endroit.">Séances, matchs, tournois et plateaux au même endroit.</p>
        </div>
      </header>

      <section className="seances-content">
        {status === "error" && <p className="seances-auth">La saison n’a pas pu être chargée.</p>}
        {calendar.undatedCount > 0 && (
          <p className="seances-hint">
            {calendar.undatedCount} événement{calendar.undatedCount > 1 ? "s" : ""} sans date réelle n’apparaît pas ici.
          </p>
        )}
        <div className="season-months">
          {calendar.months.map((month) => (
            <article className={month.isCurrent ? "season-month current" : "season-month"} key={month.key}>
              <h2>{monthLabel(month.year, month.month)}</h2>
              {month.events.length === 0 ? (
                <p>Rien de prévu.</p>
              ) : (
                <ul>
                  {month.events.map((event) => (
                    <li key={`${event.type}-${event.id}`}>
                      <Link className={`season-event ${event.type}`} href={eventHref(event)}>
                        <span>{dayLabel(event.date)}</span>
                        <strong>{event.title}</strong>
                        <small>{typeLabels[event.type]}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
