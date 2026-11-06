import type { AttendanceEntry } from "@evolyfoot/domain";

// Tournois et plateaux : même API REST côté web (competitions-panel.tsx), seules les clés de la
// réponse JSON changent.
export type CompetitionKind = "tournament" | "plateau";

export interface Competition {
  id: string;
  name: string;
  dateLabel: string;
  date: string | null;
  location: string | null;
  description: string | null;
  result: string | null;
  // Joueurs concernés (`null` = tout l'effectif), convocation et réponses.
  selectedPlayerIds?: string[] | null;
  convokedAt?: string | null;
  attendance?: AttendanceEntry[];
}

export const competitionKinds: Record<CompetitionKind, { endpoint: string; listKey: string; itemKey: string; title: string; singular: string }> = {
  tournament: { endpoint: "/api/tournaments", listKey: "tournaments", itemKey: "tournament", title: "Tournois", singular: "tournoi" },
  plateau: { endpoint: "/api/plateaux", listKey: "plateaux", itemKey: "plateau", title: "Plateaux", singular: "plateau" },
};

export function isCompetitionKind(value: unknown): value is CompetitionKind {
  return value === "tournament" || value === "plateau";
}

// "Samedi 12 septembre", comme frenchDateLabel côté web. La date ne porte que le jour : lue en UTC
// pour ne pas glisser d'un jour selon le fuseau.
export function competitionDateLabel(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .replace(/^\p{L}/u, (letter) => letter.toUpperCase());
}

export function isPastCompetition(competition: Pick<Competition, "date">, now = new Date()): boolean {
  return competition.date ? new Date(competition.date).getTime() < now.getTime() : false;
}

// Les plus proches d'abord, sans date à la fin -- même ordre que sortChronologically côté web.
export function sortCompetitions<T extends Pick<Competition, "date">>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    if (!a.date || !b.date) {
      return a.date ? -1 : b.date ? 1 : 0;
    }
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}
