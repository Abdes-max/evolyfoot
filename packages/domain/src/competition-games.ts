import { validateMatchResult, type MatchPlayerStat } from "./match-result";

// Une rencontre d'un tournoi ou d'un plateau : l'équipe adverse, le score et les buteurs / passeurs. Un
// tournoi en compte plusieurs, saisies au fil de la journée.
export interface CompetitionGame {
  readonly id: string;
  readonly opponent: string;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly playerStats: ReadonlyArray<MatchPlayerStat>;
}

export const competitionGamesMax = 40;
export const competitionOpponentMaxLength = 60;

// Premier problème des rencontres saisies, `null` si elles sont valides.
export function validateCompetitionGames(games: readonly CompetitionGame[]): string | null {
  if (games.length > competitionGamesMax) {
    return `Un tournoi ne peut pas compter plus de ${competitionGamesMax} rencontres.`;
  }
  if (new Set(games.map((game) => game.id)).size !== games.length) {
    return "Une rencontre apparaît deux fois.";
  }
  for (const [index, game] of games.entries()) {
    if (!game.opponent.trim()) {
      return `Indique l'équipe rencontrée (rencontre ${index + 1}).`;
    }
    if (game.opponent.trim().length > competitionOpponentMaxLength) {
      return `Le nom de l'équipe rencontrée est trop long (rencontre ${index + 1}).`;
    }
    const problem = validateMatchResult(game);
    if (problem) {
      return `Rencontre ${index + 1} contre ${game.opponent.trim()} : ${problem}`;
    }
  }
  return null;
}

// Rencontres lues depuis le stockage ou une requête : les entrées mal formées sont ignorées plutôt que de tout
// faire échouer.
export function parseCompetitionGames(value: unknown): CompetitionGame[] {
  if (!Array.isArray(value)) return [];
  const games: CompetitionGame[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const raw = entry as Record<string, unknown>;
    if (typeof raw.id !== "string" || typeof raw.opponent !== "string" || typeof raw.goalsFor !== "number" || typeof raw.goalsAgainst !== "number") continue;
    const stats = Array.isArray(raw.playerStats) ? raw.playerStats : [];
    games.push({
      id: raw.id,
      opponent: raw.opponent,
      goalsFor: raw.goalsFor,
      goalsAgainst: raw.goalsAgainst,
      playerStats: stats.flatMap((stat) => {
        const item = stat as Record<string, unknown> | null;
        return item &&
          typeof item.playerId === "string" &&
          typeof item.playerName === "string" &&
          typeof item.goals === "number" &&
          typeof item.assists === "number"
          ? [{ playerId: item.playerId, playerName: item.playerName, goals: item.goals, assists: item.assists }]
          : [];
      }),
    });
  }
  return games;
}

export interface CompetitionRecord {
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
}

export function competitionRecord(games: readonly CompetitionGame[]): CompetitionRecord {
  const record = { played: games.length, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const game of games) {
    record.goalsFor += game.goalsFor;
    record.goalsAgainst += game.goalsAgainst;
    if (game.goalsFor > game.goalsAgainst) record.wins += 1;
    else if (game.goalsFor < game.goalsAgainst) record.losses += 1;
    else record.draws += 1;
  }
  return record;
}

// « 2 victoires, 1 nul, 1 défaite » ; vide sans rencontre.
export function competitionRecordLabel(games: readonly CompetitionGame[]): string {
  if (games.length === 0) return "";
  const { wins, draws, losses } = competitionRecord(games);
  const parts = [
    wins > 0 ? `${wins} victoire${wins > 1 ? "s" : ""}` : "",
    draws > 0 ? `${draws} nul${draws > 1 ? "s" : ""}` : "",
    losses > 0 ? `${losses} défaite${losses > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return parts.join(", ");
}

// Une rencontre de tournoi ou de plateau vue depuis un joueur : son tournoi, l'adversaire, le score et ce qu'il a fait.
export interface PlayerCompetitionGame {
  readonly competitionName: string;
  readonly dateLabel: string;
  readonly opponent: string;
  // `null` quand le score d'un match n'est pas saisi.
  readonly goalsFor: number | null;
  readonly goalsAgainst: number | null;
  readonly goals: number;
  readonly assists: number;
}

// Rencontres où le joueur a marqué ou fait une passe décisive, dans l'ordre des tournois et plateaux fournis.
export function playerCompetitionGames(
  competitions: ReadonlyArray<{ readonly name: string; readonly dateLabel: string; readonly games?: readonly CompetitionGame[] }>,
  playerId: string,
): PlayerCompetitionGame[] {
  return competitions.flatMap((competition) =>
    (competition.games ?? []).flatMap((game) => {
      const stat = game.playerStats.find((entry) => entry.playerId === playerId);
      if (!stat || (stat.goals === 0 && stat.assists === 0)) return [];
      return [
        {
          competitionName: competition.name,
          dateLabel: competition.dateLabel,
          opponent: game.opponent,
          goalsFor: game.goalsFor,
          goalsAgainst: game.goalsAgainst,
          goals: stat.goals,
          assists: stat.assists,
        },
      ];
    }),
  );
}

// Matchs joués par le joueur (dans la feuille de match, pas signalé absent), avec le score s'il est saisi et ses buts
// et passes, même nuls. Même forme que les rencontres de tournoi pour partager la liste de la fiche joueur.
export function playerMatchGames(
  matches: ReadonlyArray<{
    readonly status: string;
    readonly opponent: string;
    readonly dateLabel: string;
    readonly goalsFor?: number | null;
    readonly goalsAgainst?: number | null;
    readonly lineup: ReadonlyArray<{ readonly playerId: string }>;
    readonly substitutePlayerIds: readonly string[];
    readonly attendance?: ReadonlyArray<{ readonly playerId: string; readonly present: boolean }>;
    readonly playerStats?: ReadonlyArray<MatchPlayerStat>;
  }>,
  playerId: string,
): PlayerCompetitionGame[] {
  return matches.flatMap((match) => {
    if (match.status !== "played") return [];
    const selected = match.lineup.some((entry) => entry.playerId === playerId) || match.substitutePlayerIds.includes(playerId);
    const absent = match.attendance?.some((entry) => entry.playerId === playerId && !entry.present) ?? false;
    if (!selected || absent) return [];
    const stat = match.playerStats?.find((entry) => entry.playerId === playerId);
    return [
      {
        competitionName: "Match",
        dateLabel: match.dateLabel,
        opponent: match.opponent,
        goalsFor: match.goalsFor ?? null,
        goalsAgainst: match.goalsAgainst ?? null,
        goals: stat?.goals ?? 0,
        assists: stat?.assists ?? 0,
      },
    ];
  });
}
