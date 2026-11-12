// Prochain rendez-vous de compétition affiché sur l'accueil (carte « Match / Compétition ») :
// match, tournoi ou plateau, le plus proche à venir.
export type NextEventKind = "match" | "tournament" | "plateau";

export interface NextEventCandidate {
  kind: NextEventKind;
  id: string;
  date: string | null;
  // Match : à jouer ; tournoi et plateau : ni terminé ni annulé.
  open: boolean;
}

const matchGraceMs = 3 * 3600_000;

// Début du jour en cours, en UTC : tournois et plateaux n'ont qu'un jour, enregistré à minuit UTC.
function todayUtc(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function isUpcoming(event: NextEventCandidate, now: Date): boolean {
  if (!event.open) return false;
  if (!event.date) return event.kind === "match";
  const time = new Date(event.date).getTime();
  return event.kind === "match" ? time >= now.getTime() - matchGraceMs : time >= todayUtc(now);
}

// Le plus proche à venir ; un match sans date passe après tout ce qui est daté.
export function nextEvent<T extends NextEventCandidate>(events: readonly T[], now = new Date()): T | null {
  const upcoming = events
    .filter((event) => isUpcoming(event, now))
    .sort((a, b) => (a.date ? new Date(a.date).getTime() : Infinity) - (b.date ? new Date(b.date).getTime() : Infinity));
  return upcoming[0] ?? null;
}

export const nextEventKindLabels: Record<NextEventKind, string> = { match: "Match", tournament: "Tournoi", plateau: "Plateau" };
