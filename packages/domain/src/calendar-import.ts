import type { MatchVenue } from "./match";

// Lecture d'un fichier de calendrier .ics (Google Agenda, Outlook, Apple, sites de ligue). Le
// fichier reste dans le navigateur : seuls les matchs cochés par l'éducateur sont créés.
export interface CalendarEvent {
  readonly title: string;
  readonly date: Date | null;
  readonly location: string | null;
}

export interface ImportedFixture {
  readonly opponent: string;
  readonly venue: MatchVenue;
}

const maxCalendarEvents = 200;
// Un événement sans heure (journée entière) : créneau neutre, à ajuster sur la fiche du match.
const defaultHour = 12;

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\([,;\\])/g, "$1")
    .trim();
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second, utc] = match;
  const parts = [Number(year), Number(month) - 1, Number(day), Number(hour ?? defaultHour), Number(minute ?? 0), Number(second ?? 0)] as const;
  const date = utc ? new Date(Date.UTC(...parts)) : new Date(...parts);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseCalendarFile(content: string): CalendarEvent[] {
  // Une ligne longue se poursuit sur la suivante, qui commence par une espace ou une tabulation.
  const lines = content
    .replace(/\r\n?/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
  const events: CalendarEvent[] = [];
  let current: { title: string; date: Date | null; location: string | null } | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = { title: "", date: null, location: null };
    } else if (line === "END:VEVENT") {
      if (current?.title) {
        events.push(current);
      }
      current = null;
    } else if (current) {
      const separator = line.indexOf(":");
      if (separator < 0) {
        continue;
      }
      const name = line.slice(0, separator).split(";")[0]!.toUpperCase();
      const value = line.slice(separator + 1);
      if (name === "SUMMARY") {
        current.title = unescapeText(value);
      } else if (name === "DTSTART") {
        current.date = parseDate(value);
      } else if (name === "LOCATION") {
        current.location = unescapeText(value) || null;
      }
    }
  }

  return events.slice(0, maxCalendarEvents);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

// « FC Horizon - US Vallée » : l'adversaire est l'autre équipe, et la première citée reçoit.
export function fixtureFromTitle(title: string, teamName: string): ImportedFixture {
  const sides = title.split(/\s+(?:-|–|—|vs\.?|contre|\/)\s+/i).map((side) => side.trim());
  const [first, second] = sides;
  if (sides.length === 2 && first && second) {
    const team = normalize(teamName);
    if (team && normalize(first).includes(team)) {
      return { opponent: second, venue: "home" };
    }
    if (team && normalize(second).includes(team)) {
      return { opponent: first, venue: "away" };
    }
  }
  return { opponent: title, venue: "home" };
}
