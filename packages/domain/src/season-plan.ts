import { diagnosticCriteria, type DiagnosticScores } from "./diagnostic";
import type { DevelopmentTheme } from "./index";
import { seasonStartYear } from "./season";
import { trainingCycleWeekCount } from "./training-calendar";

// Projection de la saison depuis le cycle en cours : les priorités du diagnostic reviennent à tour
// de rôle jusqu'en juin. Le diagnostic refait à chaque cycle met cette projection à jour.
export interface SeasonPlanCycle {
  readonly number: number;
  readonly start: Date;
  readonly end: Date;
  readonly theme: DevelopmentTheme;
  readonly supportTheme: DevelopmentTheme;
  readonly intent: string;
  readonly current: boolean;
}

const dayMs = 24 * 60 * 60 * 1000;
const seasonLastMonth = 5; // juin, en index JavaScript
const intents = ["Découvrir et installer", "Renforcer sous pression", "Confirmer en match"] as const;
const allThemes: readonly DevelopmentTheme[] = ["Conserver le ballon", "Progresser ensemble", "Finir les actions", "Récupérer rapidement"];

function startOfWeek(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function buildSeasonPlan(scores: DiagnosticScores, cycleNumber: number, activeWeek: number, now: Date): SeasonPlanCycle[] {
  // Plusieurs critères peuvent porter le même thème : chaque thème passe une fois par tour, les
  // priorités du diagnostic d'abord.
  const ranked = [...diagnosticCriteria].sort((a, b) => scores[a.id] - scores[b.id]).map((criterion) => criterion.theme);
  const themes = [...new Set([...ranked, ...allThemes])];
  const seasonEnd = new Date(seasonStartYear(now) + 1, seasonLastMonth + 1, 0);
  const firstStart = addDays(startOfWeek(now), -(activeWeek - 1) * 7);
  const cycleDays = trainingCycleWeekCount * 7;
  const cycles: SeasonPlanCycle[] = [];

  for (let index = 0; ; index += 1) {
    const start = addDays(firstStart, index * cycleDays);
    if (start.getTime() + dayMs > seasonEnd.getTime()) {
      break;
    }
    cycles.push({
      number: cycleNumber + index,
      start,
      end: addDays(start, cycleDays - 1),
      theme: themes[index % themes.length]!,
      supportTheme: themes[(index + 1) % themes.length]!,
      intent: intents[Math.min(Math.floor(index / themes.length), intents.length - 1)]!,
      current: index === 0,
    });
  }
  return cycles;
}
