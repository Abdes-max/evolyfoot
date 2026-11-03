export type SeasonEventType = "session" | "match" | "tournament" | "plateau";

export interface SeasonEventInput {
  id: string;
  type: SeasonEventType;
  title: string;
  // ISO, `null` pour un événement sans date réelle.
  date: string | null;
}

export interface SeasonEvent extends SeasonEventInput {
  date: string;
}

export interface SeasonMonth {
  key: string;
  year: number;
  month: number;
  isCurrent: boolean;
  events: SeasonEvent[];
}

export interface SeasonCalendar {
  label: string;
  months: SeasonMonth[];
  undatedCount: number;
}

const seasonFirstMonth = 7; // août, en index JavaScript
const seasonMonthCount = 11; // août à juin

// Saison de football : d'août à juin. En juillet, on prépare déjà la saison à venir.
export function seasonStartYear(now: Date): number {
  return now.getMonth() >= seasonFirstMonth - 1 ? now.getFullYear() : now.getFullYear() - 1;
}

// Début de la saison en cours, aligné sur `seasonStartYear` : le 1er juillet (heure locale), la
// préparation comptant déjà pour la saison à venir.
export function seasonStartDate(now: Date): Date {
  return new Date(seasonStartYear(now), seasonFirstMonth - 1, 1);
}

export function seasonLabel(startYear: number): string {
  return `${startYear}-${startYear + 1}`;
}

export function buildSeasonCalendar(events: readonly SeasonEventInput[], now: Date): SeasonCalendar {
  const startYear = seasonStartYear(now);
  const months: SeasonMonth[] = Array.from({ length: seasonMonthCount }, (_, index) => {
    const start = new Date(startYear, seasonFirstMonth + index, 1);
    const year = start.getFullYear();
    const month = start.getMonth();
    return {
      key: `${year}-${month + 1}`,
      year,
      month,
      isCurrent: year === now.getFullYear() && month === now.getMonth(),
      events: [],
    };
  });

  let undatedCount = 0;
  for (const event of events) {
    const date = event.date ? new Date(event.date) : null;
    if (!date || Number.isNaN(date.getTime())) {
      undatedCount += 1;
      continue;
    }
    months.find((month) => month.year === date.getFullYear() && month.month === date.getMonth())?.events.push({ ...event, date: event.date as string });
  }
  for (const month of months) {
    month.events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  return { label: `Saison ${seasonLabel(startYear)}`, months, undatedCount };
}
