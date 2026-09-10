"use client";

import type { TrainingDay } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
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

interface DayMatch {
  id: string;
  opponent: string;
}

export function WeeklyCalendar() {
  const [trainingDays, setTrainingDays] = useState<readonly TrainingDay[]>([]);
  // Jour → match correspondant (id + adversaire, pour ouvrir sa fiche et pour l'intitulé
  // accessible du lien), pas juste un ensemble de jours : il faut savoir VERS QUEL match ouvrir.
  const [matchByDay, setMatchByDay] = useState<ReadonlyMap<string, DayMatch>>(new Map());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled || !sessionBody.educator) {
          return;
        }

        const [teamResponse, matchesResponse] = await Promise.all([fetch("/api/team"), fetch("/api/matches")]);
        const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
        const matchesBody = await matchesResponse.json().catch(() => ({ matches: [] }));
        if (cancelled) {
          return;
        }

        setTrainingDays(teamBody.profile?.trainingDays ?? []);

        // `dateLabel` est un texte libre saisi par l'éducateur ("Samedi 26 septembre · 14:00 ·
        // Domicile"), pas une date structurée -- impossible de savoir avec certitude à quelle
        // semaine calendaire un match appartient. On se contente de repérer le jour de la semaine
        // en tête du texte, suffisant pour ce calendrier hebdomadaire indicatif (repli silencieux
        // si le format ne commence pas par un nom de jour reconnu). Si deux matchs tombent sur le
        // même jour, seul le premier rencontré garde la main sur l'icône -- cas rare, acceptable
        // pour un simple repère visuel plutôt qu'un vrai agenda.
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

  return (
    <div className="week-card week-calendar">
      <h3>Calendrier</h3>
      <div className="week-calendar-grid">
        {weekDays.map((day) => {
          const hasTraining = trainingDays.includes(day.full as TrainingDay);
          const match = matchByDay.get(day.full);
          return (
            <div className="week-calendar-day" key={day.full}>
              <span className="week-calendar-day-label">{day.short}</span>
              <div className="week-calendar-cell">
                {hasTraining && (
                  <Link
                    aria-label={`Ouvrir la séance du ${day.full.toLowerCase()}`}
                    className="week-calendar-badge training"
                    href="/session"
                    title="Séance d’entraînement"
                  >
                    <TargetIcon />
                  </Link>
                )}
                {match && (
                  <Link
                    aria-label={`Ouvrir le match du ${day.full.toLowerCase()} contre ${match.opponent}`}
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
      <Link aria-label="Voir tous les matchs" className="text-button week-calendar-footer" href="/match">
        Voir mes matchs →
      </Link>
    </div>
  );
}
