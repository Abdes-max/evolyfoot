// Résultat d'un match joué, saisi par l'éducateur : le score et, pour chaque joueur concerné, ses
// buts et passes décisives. Les noms sont dupliqués comme dans la composition (MatchLineupAssignment).
export interface MatchPlayerStat {
  readonly playerId: string;
  readonly playerName: string;
  readonly goals: number;
  readonly assists: number;
}

export interface MatchResult {
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly playerStats: ReadonlyArray<MatchPlayerStat>;
}

export const matchResultMaxGoals = 99;

function isCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= matchResultMaxGoals;
}

// Renvoie le premier problème du résultat, `null` s'il est valide. Un but contre son camp adverse
// reste possible : le total des buteurs peut être inférieur au score, jamais supérieur.
export function validateMatchResult(result: MatchResult): string | null {
  if (!isCount(result.goalsFor) || !isCount(result.goalsAgainst)) {
    return "Le score doit être un nombre entre 0 et 99.";
  }
  if (result.playerStats.some((stat) => !isCount(stat.goals) || !isCount(stat.assists))) {
    return "Les buts et passes doivent être des nombres entre 0 et 99.";
  }
  if (new Set(result.playerStats.map((stat) => stat.playerId)).size !== result.playerStats.length) {
    return "Un joueur apparaît deux fois.";
  }
  const goals = result.playerStats.reduce((sum, stat) => sum + stat.goals, 0);
  const assists = result.playerStats.reduce((sum, stat) => sum + stat.assists, 0);
  if (goals > result.goalsFor) {
    return "Il y a plus de buteurs que de buts marqués.";
  }
  if (assists > result.goalsFor) {
    return "Il y a plus de passes décisives que de buts marqués.";
  }
  return null;
}

export interface PlayerSeasonTotals {
  readonly matches: number;
  readonly goals: number;
  readonly assists: number;
}

interface PlayedMatchFacts {
  readonly status: string;
  readonly lineup: ReadonlyArray<{ readonly playerId: string }>;
  readonly substitutePlayerIds: readonly string[];
  readonly attendance?: ReadonlyArray<{ readonly playerId: string; readonly present: boolean }>;
  readonly playerStats?: ReadonlyArray<MatchPlayerStat>;
}

// Totaux d'un joueur sur ses matchs joués : présent dans la feuille de match et pas signalé absent.
export function playerSeasonTotals(matches: readonly PlayedMatchFacts[], playerId: string): PlayerSeasonTotals {
  let played = 0;
  let goals = 0;
  let assists = 0;
  for (const match of matches) {
    if (match.status !== "played") {
      continue;
    }
    const selected = match.lineup.some((entry) => entry.playerId === playerId) || match.substitutePlayerIds.includes(playerId);
    const absent = match.attendance?.some((entry) => entry.playerId === playerId && !entry.present) ?? false;
    if (selected && !absent) {
      played += 1;
    }
    const stat = match.playerStats?.find((entry) => entry.playerId === playerId);
    goals += stat?.goals ?? 0;
    assists += stat?.assists ?? 0;
  }
  return { matches: played, goals, assists };
}
