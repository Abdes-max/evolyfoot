import Link from "next/link";
import { BallIcon, TargetIcon } from "../../icons";
import { currentCycleWeek } from "../../session/cycle";
import { todayWeekDayFull } from "../../today";
import type { Dashboard, DashboardMatch } from "./use-player-dashboard";

const weekDays: ReadonlyArray<{ short: string; full: string }> = [
  { short: "LUN.", full: "Lundi" },
  { short: "MAR.", full: "Mardi" },
  { short: "MER.", full: "Mercredi" },
  { short: "JEU.", full: "Jeudi" },
  { short: "VEN.", full: "Vendredi" },
  { short: "SAM.", full: "Samedi" },
  { short: "DIM.", full: "Dimanche" },
];

// Même grille que le calendrier du coach (apps/web/weekly-calendar.tsx), en lecture seule pour ce
// qui est de l'entraînement (pas de séance en base tant que le coach ne l'a pas générée) -- le
// badge d'un match ouvre en revanche sa page de détail (/joueur/matches/:id).
export function WeekCalendar({ dashboard }: { dashboard: Dashboard }) {
  const trainingDays = dashboard.team?.trainingDays ?? [];
  const activeWeek = currentCycleWeek(dashboard.trainingSlots, Math.max(trainingDays.length, 1));

  const trainingByDay = new Map<string, boolean>();
  let slot = 0;
  for (const day of weekDays) {
    if (trainingDays.includes(day.full)) {
      const generated = dashboard.trainingSlots.some((entry) => entry.weekNumber === activeWeek && entry.slot === slot);
      trainingByDay.set(day.full, generated);
      slot += 1;
    }
  }

  // `dateLabel` est un texte libre ("Samedi 26 septembre · 14:00 · Domicile") : on repère juste le
  // jour en tête, comme côté coach -- un calendrier indicatif, pas une source de vérité.
  const matchByDay = new Map<string, DashboardMatch>();
  for (const match of dashboard.upcomingMatches) {
    const day = weekDays.find((candidate) => match.dateLabel.startsWith(candidate.full));
    if (day && !matchByDay.has(day.full)) {
      matchByDay.set(day.full, match);
    }
  }

  return (
    <div className="week-card week-calendar">
      <div className="week-calendar-grid">
        {weekDays.map((day) => {
          const hasTraining = trainingByDay.has(day.full);
          const match = matchByDay.get(day.full);
          const isToday = day.full === todayWeekDayFull();
          return (
            <div className={isToday ? "week-calendar-day today" : "week-calendar-day"} key={day.full}>
              <span className="week-calendar-day-label">{day.short}</span>
              <div className="week-calendar-cell">
                {hasTraining && (
                  <span className="week-calendar-badge training" title="Séance d’entraînement">
                    <TargetIcon />
                  </span>
                )}
                {match && (
                  <Link
                    aria-label={`Voir le détail du match contre ${match.opponent}`}
                    className="week-calendar-badge match"
                    href={`/joueur/matches/${match.id}`}
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
      </ul>
    </div>
  );
}
