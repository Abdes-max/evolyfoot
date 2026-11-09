import type { MatchStatus } from "./match";

export type MatchScope = "upcoming" | "past";

export const matchScopeLabels: Record<MatchScope, string> = { upcoming: "À venir", past: "Passés" };

// Même marge que l'accueil : un match commencé il y a moins de 3 h reste « à venir » (il se joue encore
// ou vient de finir, et attend d'être marqué joué).
const gracePeriodMs = 3 * 3600_000;

interface Datable {
  status: MatchStatus;
  date?: string | null;
}

// Passé : un match joué, ou dont le coup d'envoi date de plus de 3 h. Un match sans date n'est jamais passé.
export function isPastMatch(match: Datable, now: number): boolean {
  if (match.status === "played") return true;
  return match.date ? new Date(match.date).getTime() < now - gracePeriodMs : false;
}

// Matchs du filtre, les plus proches d'abord à venir, les plus récents d'abord passés. Sans date : en fin de liste.
export function matchesInScope<T extends Datable>(matches: readonly T[], scope: MatchScope, now: number): T[] {
  const time = (match: T, empty: number) => (match.date ? new Date(match.date).getTime() : empty);
  return matches
    .filter((match) => isPastMatch(match, now) === (scope === "past"))
    .sort((a, b) => (scope === "upcoming" ? time(a, Infinity) - time(b, Infinity) : time(b, -Infinity) - time(a, -Infinity)));
}
