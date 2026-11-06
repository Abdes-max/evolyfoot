"use client";

import {
  buildPrioritizedSeason,
  guidedSeasonCycle,
  seasonSlotColor,
  seasonWeekAt,
  themeColors,
  type DevelopmentTheme,
  type TrainingDay,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { currentCycleWeek } from "./session/cycle";
import { todayWeekDayFull } from "./today";
import { BallIcon, DotsGridIcon, TargetIcon } from "./icons";

const weekDays: ReadonlyArray<{ short: string; full: TrainingDay | "Samedi" | "Dimanche" }> = [
  { short: "LUN.", full: "Lundi" },
  { short: "MAR.", full: "Mardi" },
  { short: "MER.", full: "Mercredi" },
  { short: "JEU.", full: "Jeudi" },
  { short: "VEN.", full: "Vendredi" },
  { short: "SAM.", full: "Samedi" },
  { short: "DIM.", full: "Dimanche" },
];

interface MatchSummary {
  id: string;
  opponent: string;
  dateLabel: string;
  status: string;
}

interface SavedSession {
  id: string;
  weekNumber: number;
  slot: number;
  cycleNumber?: number;
  theme?: string;
}

interface DayMatch {
  id: string;
  opponent: string;
}

// Séance d'un jour d'entraînement : soit déjà générée (on connaît son id, on l'ouvre), soit à
// générer pour le créneau (semaine du cycle + slot) que ce jour occupe.
interface DayTraining {
  sessionId: string | null;
  // Lien de préparation quand la séance n'existe pas encore, couleur du thème de la séance.
  prepareHref: string;
  color: string | null;
}

export function WeeklyCalendar() {
  const [trainingDays, setTrainingDays] = useState<readonly TrainingDay[]>([]);
  const [sessions, setSessions] = useState<readonly SavedSession[]>([]);
  const [matchByDay, setMatchByDay] = useState<ReadonlyMap<string, DayMatch>>(new Map());
  // Saison guidée : la semaine montre alors les séances prévues par la saison (voir seasonCycles).
  const [program, setProgram] = useState<{ priorities: DevelopmentTheme[]; startDate: string } | null>(null);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(2);
  const [seasonSessions, setSeasonSessions] = useState<readonly SavedSession[]>([]);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled || !sessionBody.educator) {
          return;
        }

        const [teamResponse, matchesResponse, sessionsResponse, programResponse, seasonSessionsResponse] = await Promise.all([
          fetch("/api/team"),
          fetch("/api/matches"),
          fetch("/api/sessions"),
          fetch("/api/season-program"),
          fetch("/api/sessions?scope=season"),
        ]);
        const programBody = await programResponse.json().catch(() => ({ program: null }));
        const seasonSessionsBody = await seasonSessionsResponse.json().catch(() => ({ sessions: [] }));
        const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
        const matchesBody = await matchesResponse.json().catch(() => ({ matches: [] }));
        const sessionsBody = await sessionsResponse.json().catch(() => ({ sessions: [] }));
        if (cancelled) {
          return;
        }

        setTrainingDays(teamBody.profile?.trainingDays ?? []);
        setSessions(sessionsBody.sessions ?? []);
        setProgram(programBody.program ?? null);
        setSessionsPerWeek(teamBody.profile?.sessionsPerWeek ?? 2);
        setSeasonSessions(((seasonSessionsBody.sessions ?? []) as SavedSession[]).filter((session) => session.cycleNumber === guidedSeasonCycle));

        // `dateLabel` est un texte libre saisi par l'éducateur ("Samedi 26 septembre · 14:00 ·
        // Domicile"), pas une date structurée -- on se contente de repérer le nom du jour en tête
        // du texte, suffisant pour ce calendrier hebdomadaire indicatif (repli silencieux sinon).
        // Si deux matchs tombent le même jour, seul le premier garde l'icône.
        const matches: MatchSummary[] = matchesBody.matches ?? [];
        const byDay = new Map<string, DayMatch>();
        for (const match of matches) {
          if (match.status !== "scheduled") {
            continue;
          }
          const day = weekDays.find((candidate) => match.dateLabel.startsWith(candidate.full));
          if (day && !byDay.has(day.full)) {
            byDay.set(day.full, { id: match.id, opponent: match.opponent });
          }
        }
        setMatchByDay(byDay);
      } catch {
        // Reste sur un calendrier vide.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeWeek = currentCycleWeek(sessions, Math.max(trainingDays.length, 1));
  // Chaque jour d'entraînement de la semaine occupe un slot, dans l'ordre où il apparaît dans la
  // semaine (lundi = slot 0, etc.) -- même convention que la page Séances.
  // Avec une saison guidée, ce sont les séances de la semaine en cours de la saison.
  const seasonWeek = program ? seasonWeekAt(new Date(`${program.startDate}T00:00:00`), now) : 0;
  const seasonSlots = program
    ? (buildPrioritizedSeason({ priorities: program.priorities, sessionsPerWeek }).find((week) => week.week === seasonWeek)?.slots ?? [])
    : [];
  const trainingByDay = new Map<string, DayTraining>();
  let slot = 0;
  for (const day of weekDays) {
    if (trainingDays.includes(day.full as TrainingDay)) {
      if (program) {
        const planned = seasonSlots[slot];
        const saved = seasonSessions.find((session) => session.weekNumber === seasonWeek && session.slot === slot);
        if (planned) {
          trainingByDay.set(day.full, {
            sessionId: saved?.id ?? null,
            prepareHref: `/saison/seance/${planned.sessionNumber}?semaine=${seasonWeek}&creneau=${slot}`,
            color: seasonSlotColor(planned),
          });
        }
      } else {
        const saved = sessions.find((session) => session.weekNumber === activeWeek && session.slot === slot);
        trainingByDay.set(day.full, {
          sessionId: saved?.id ?? null,
          prepareHref: `/session?week=${activeWeek}&slot=${slot}`,
          color: saved?.theme ? (themeColors[saved.theme as DevelopmentTheme] ?? null) : null,
        });
      }
      slot += 1;
    }
  }

  return (
    <div className="week-card week-calendar">
      <h3>Calendrier</h3>
      <div className="week-calendar-grid">
        {weekDays.map((day) => {
          const training = trainingByDay.get(day.full);
          const match = matchByDay.get(day.full);
          const isToday = day.full === todayWeekDayFull();
          return (
            <div className={isToday ? "week-calendar-day today" : "week-calendar-day"} key={day.full}>
              <span className="week-calendar-day-label">{day.short}</span>
              <div className="week-calendar-cell">
                {training &&
                  (training.sessionId ? (
                    <Link
                      aria-label={`Ouvrir la séance de ${day.full.toLowerCase()}`}
                      className="week-calendar-badge training"
                      href={`/session/${training.sessionId}`}
                      style={training.color ? { background: training.color, borderColor: training.color } : undefined}
                      title="Séance d’entraînement"
                    >
                      <TargetIcon />
                    </Link>
                  ) : (
                    <Link
                      aria-label={`Générer la séance de ${day.full.toLowerCase()} (non générée)`}
                      className="week-calendar-badge training pending"
                      href={training.prepareHref}
                      style={training.color ? { borderColor: training.color, color: training.color } : undefined}
                      title="Séance non générée"
                    >
                      <TargetIcon />
                    </Link>
                  ))}
                {match && (
                  <Link
                    aria-label={`Ouvrir le match de ${day.full.toLowerCase()} contre ${match.opponent}`}
                    className="week-calendar-badge match"
                    href={`/match/${match.id}`}
                    title={`Match contre ${match.opponent}`}
                  >
                    <BallIcon />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ul className="week-calendar-legend">
        <li>
          <span className="week-calendar-badge training">
            <TargetIcon />
          </span>
          Séance d’entraînement
        </li>
        <li>
          <span className="week-calendar-badge training pending">
            <TargetIcon />
          </span>
          Séance non générée
        </li>
        <li>
          <span className="week-calendar-badge match">
            <BallIcon />
          </span>
          Match / compétition
        </li>
        <li>
          <span className="week-calendar-badge other">
            <DotsGridIcon />
          </span>
          Autres
        </li>
      </ul>
      <Link aria-label="Voir toutes mes séances" className="text-button week-calendar-footer" href="/seances">
        Voir mes séances →
      </Link>
    </div>
  );
}
