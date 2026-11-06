import type { DevelopmentPlan, DevelopmentWeek } from "./development-plan";
import { programSubThemes, type SeasonSlot, type SeasonWeek } from "./season-program";
import type { DevelopmentTheme } from "./themes";

// La saison guidée (36 semaines) se lit en cycles de 4 semaines : chaque cycle reprend les séances
// de la saison sur ses semaines, et son thème vient des priorités de la saison. Un compte sans
// saison garde le cycle court construit depuis le diagnostic (buildDevelopmentPlan).
export const seasonCycleLength = 4;

const phases: readonly DevelopmentWeek["phase"][] = ["Découvrir", "Stabiliser", "Mettre sous pression", "Évaluer"];

export interface SeasonCycleWeek {
  readonly seasonWeek: number;
  readonly weekInCycle: number;
  readonly phase: DevelopmentWeek["phase"];
  readonly theme: DevelopmentTheme;
  readonly intention: string;
  readonly slots: readonly SeasonSlot[];
}

export interface SeasonCycle {
  readonly number: number;
  readonly count: number;
  readonly theme: DevelopmentTheme;
  readonly supportTheme: DevelopmentTheme | null;
  readonly weeks: readonly SeasonCycleWeek[];
}

function slotTheme(slot: SeasonSlot): DevelopmentTheme | null {
  return slot.subTheme ? programSubThemes[slot.subTheme].theme : null;
}

// Thèmes classés par nombre de séances (une séance prioritaire compte un peu plus), à égalité dans
// leur ordre d'apparition.
function rankedThemes(slots: readonly SeasonSlot[]): DevelopmentTheme[] {
  const weights = new Map<DevelopmentTheme, number>();
  for (const slot of slots) {
    const theme = slotTheme(slot);
    if (theme) weights.set(theme, (weights.get(theme) ?? 0) + (slot.major ? 1.5 : 1));
  }
  return [...weights.entries()].sort((a, b) => b[1] - a[1]).map(([theme]) => theme);
}

function weekIntention(slots: readonly SeasonSlot[]): string {
  const labels = [...new Set(slots.flatMap((slot) => (slot.subTheme ? [programSubThemes[slot.subTheme].label] : [])))];
  if (labels.length > 0) return labels.join(" · ");
  if (slots.some((slot) => slot.type === "evaluation")) return "Évaluer les progrès de l’équipe.";
  return "Jouer pour le plaisir, sans consigne de thème.";
}

export function seasonCycles(season: readonly SeasonWeek[], fallbackTheme: DevelopmentTheme = "Conserver le ballon"): SeasonCycle[] {
  const count = Math.ceil(season.length / seasonCycleLength);
  return Array.from({ length: count }, (_, index) => {
    const weeks = season.slice(index * seasonCycleLength, (index + 1) * seasonCycleLength);
    const ranked = rankedThemes(weeks.flatMap((week) => week.slots));
    const theme = ranked[0] ?? fallbackTheme;
    return {
      number: index + 1,
      count,
      theme,
      supportTheme: ranked[1] ?? null,
      weeks: weeks.map((week, position) => ({
        seasonWeek: week.week,
        weekInCycle: position + 1,
        phase: phases[position]!,
        theme: rankedThemes(week.slots)[0] ?? theme,
        intention: weekIntention(week.slots),
        slots: week.slots,
      })),
    };
  });
}

// Cycle qui contient cette semaine de la saison (le dernier au-delà de la fin).
export function seasonCycleAt(cycles: readonly SeasonCycle[], seasonWeek: number): SeasonCycle | null {
  return cycles.find((cycle) => cycle.weeks.some((week) => week.seasonWeek === seasonWeek)) ?? cycles.at(-1) ?? null;
}

// Le cycle de la saison sous la forme d'un plan de 4 semaines, pour les écrans qui affichent un cycle
// (vue d'ensemble, plan, séances).
export function seasonCycleAsPlan(cycle: SeasonCycle): DevelopmentPlan {
  const first = cycle.weeks[0]?.seasonWeek ?? 1;
  const last = cycle.weeks.at(-1)?.seasonWeek ?? first;
  return {
    title: `Cycle ${cycle.number}/${cycle.count} · ${cycle.theme}`,
    primaryTheme: cycle.theme,
    secondaryTheme: cycle.supportTheme ?? cycle.theme,
    explanation: `Semaines ${first} à ${last} de ta saison : ${cycle.theme}${cycle.supportTheme ? `, avec ${cycle.supportTheme} en soutien` : ""}.`,
    weeks: cycle.weeks.map((week) => ({
      week: week.weekInCycle,
      phase: week.phase,
      theme: week.theme,
      intention: week.intention,
      observable: `Semaine ${week.seasonWeek} de la saison.`,
    })),
  };
}

// Prochaine séance de la saison à préparer, à partir de la semaine donnée : celle que propose la
// vue d'ensemble quand aucune séance n'est encore datée.
export function nextSeasonSlot(
  season: readonly SeasonWeek[],
  prepared: readonly { weekNumber: number; slot: number }[],
  fromWeek: number,
): { week: number; index: number; slot: SeasonSlot } | null {
  for (const week of season) {
    if (week.week < fromWeek) continue;
    const index = week.slots.findIndex((_, position) => !prepared.some((done) => done.weekNumber === week.week && done.slot === position));
    if (index >= 0) return { week: week.week, index, slot: week.slots[index]! };
  }
  return null;
}

// Couleur de chaque thème, reprise partout où une séance est affichée (saison, cycle, calendrier).
export const themeColors: Readonly<Record<DevelopmentTheme, string>> = {
  "Conserver le ballon": "#3ec6f5",
  "Progresser ensemble": "#2bc4a8",
  "Finir les actions": "#f59e3e",
  "Récupérer rapidement": "#ef5a5a",
  "Protéger son but": "#a678f0",
};

export function seasonSlotColor(slot: Pick<SeasonSlot, "type" | "subTheme">): string {
  if (slot.subTheme) return themeColors[programSubThemes[slot.subTheme].theme];
  return slot.type === "evaluation" ? "#8a93a6" : "#d4b05a";
}
