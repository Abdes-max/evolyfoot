"use client";

import {
  buildPrioritizedSeason,
  buildSeasonCalendar,
  guidedSeasonCycle,
  seasonSlotColor,
  seasonSlotDate,
  themeColors,
  type DevelopmentTheme,
  type SeasonEvent,
  type SeasonEventInput,
  type SeasonEventType,
  type TrainingDay,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GuidedSeason, slotLabel } from "./guided-season";
import { SeasonPlanView } from "./season-plan-view";

const typeLabels: Record<SeasonEventType, string> = {
  session: "Séance",
  match: "Match",
  tournament: "Tournoi",
  plateau: "Plateau",
};

// Événement du calendrier : les séances encore à préparer de la saison guidée y figurent aussi, à
// la date proposée (jour d'entraînement de l'équipe), avec un lien vers leur fiche.
interface CalendarEvent extends SeasonEventInput {
  href?: string;
  planned?: boolean;
  // Couleur du thème de la séance (voir themeColors).
  color?: string;
}

const weekdayHeaders = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function eventHref(event: CalendarEvent): string {
  if (event.href) return event.href;
  if (event.type === "session") return `/session/${event.id}`;
  if (event.type === "match") return `/match/${event.id}`;
  if (event.type === "tournament") return `/match/tournois/${event.id}`;
  return `/match/plateaux/${event.id}`;
}

function monthLabel(year: number, month: number): string {
  const label = new Date(year, month, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// Grille du mois, semaines du lundi au dimanche : `null` pour les cases hors du mois.
function monthGrid(year: number, month: number): (number | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function sameDay(date: Date, year: number, month: number, day: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
}

interface SeasonSessionSummary {
  id: string;
  title: string;
  meetingAt: string | null;
  cycleNumber: number;
  weekNumber: number;
  slot: number;
  theme?: DevelopmentTheme;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- corps JSON lu champ par champ
async function readBody(url: string): Promise<any> {
  const response = await fetch(url).catch(() => null);
  return response?.ok ? response.json().catch(() => null) : null;
}

async function readList<Item>(url: string, key: string): Promise<Item[]> {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  return response.ok ? (body[key] ?? []) : [];
}

export function SaisonView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [sessions, matches, tournaments, plateaux, programBody, teamBody] = await Promise.all([
          readList<SeasonSessionSummary>("/api/sessions?scope=season", "sessions"),
          readList<{ id: string; opponent: string; date: string | null }>("/api/matches", "matches"),
          readList<{ id: string; name: string; date: string | null }>("/api/tournaments", "tournaments"),
          readList<{ id: string; name: string; date: string | null }>("/api/plateaux", "plateaux"),
          readBody("/api/season-program"),
          readBody("/api/team"),
        ]);
        if (cancelled) {
          return;
        }
        const program: { priorities: DevelopmentTheme[]; startDate: string } | null = programBody?.program ?? null;
        const profile: { sessionsPerWeek?: number; trainingDays?: TrainingDay[] } | null = teamBody?.profile ?? null;
        // Séances de la saison guidée pas encore préparées : placées à leur date proposée.
        const planned: CalendarEvent[] = program
          ? buildPrioritizedSeason({ priorities: program.priorities, sessionsPerWeek: profile?.sessionsPerWeek ?? 2 }).flatMap((week) =>
              week.slots.flatMap((slot, index) =>
                sessions.some((session) => session.cycleNumber === guidedSeasonCycle && session.weekNumber === week.week && session.slot === index)
                  ? []
                  : [
                      {
                        id: `prevue-${week.week}-${index}`,
                        type: "session" as const,
                        title: slotLabel(slot),
                        date: seasonSlotDate(new Date(`${program.startDate}T00:00:00`), week.week, index, profile?.trainingDays ?? []).toISOString(),
                        href: `/saison/seance/${slot.sessionNumber}?semaine=${week.week}&creneau=${index}`,
                        planned: true,
                        color: seasonSlotColor(slot),
                      },
                    ],
              ),
            )
          : [];
        setEvents([
          ...planned,
          ...sessions.map((session) => ({
            id: session.id,
            type: "session" as const,
            title: session.title,
            date: session.meetingAt,
            color: session.theme ? themeColors[session.theme] : undefined,
          })),
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
        <GuidedSeason fallback={<SeasonPlanView now={now} />} now={now} />
        {calendar.undatedCount > 0 && (
          <p className="seances-hint">
            {calendar.undatedCount} événement{calendar.undatedCount > 1 ? "s" : ""} sans date réelle n’apparaît pas ici.
          </p>
        )}
        <div className="season-months">
          {calendar.months.map((month) => (
            <article className={month.isCurrent ? "season-month current" : "season-month"} key={month.key}>
              <h2>{monthLabel(month.year, month.month)}</h2>
              <div className="season-month-grid" role="grid">
                {weekdayHeaders.map((header) => (
                  <span className="season-weekday" key={header} role="columnheader">
                    {header}
                  </span>
                ))}
                {monthGrid(month.year, month.month).map((day, index) =>
                  day === null ? (
                    <span aria-hidden className="season-day empty" key={`vide-${index}`} />
                  ) : (
                    <div className={sameDay(now, month.year, month.month, day) ? "season-day today" : "season-day"} key={day} role="gridcell">
                      <span className="season-day-number">{day}</span>
                      {month.events
                        .filter((event) => sameDay(new Date(event.date), month.year, month.month, day))
                        .map((event: SeasonEvent<CalendarEvent>) => (
                          <Link
                            className={`season-event ${event.type}${event.planned ? " planned" : ""}`}
                            style={event.color ? { borderLeftColor: event.color, borderLeftWidth: 3, borderLeftStyle: "solid" } : undefined}
                            href={eventHref(event)}
                            key={`${event.type}-${event.id}`}
                            title={`${typeLabels[event.type]}${event.planned ? " à préparer" : ""} · ${event.title} · ${timeLabel(event.date)}`}
                          >
                            <strong>{event.title}</strong>
                            <small>{event.planned ? "À préparer" : timeLabel(event.date)}</small>
                          </Link>
                        ))}
                    </div>
                  ),
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
