export interface AttendanceStats {
  present: number;
  absent: number;
  total: number;
  rate: number;
}

// Chiffres de saison renvoyés par `GET /api/stats`, partagés par le web et EvolyFoot Coach.
export interface TeamStats {
  trainingCount: number;
  matchCount: number;
  matchesPlayed: number;
  matchesScheduled: number;
  tournamentCount: number;
  plateauCount: number;
  trainingAttendance: AttendanceStats;
  matchAttendance: AttendanceStats;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`;
}

// Synthèse purement factuelle des chiffres, pas d'analyse « intelligente ».
export function buildTeamStatsReport(stats: TeamStats): string[] {
  const lines: string[] = [];
  lines.push(
    `Depuis le début de la saison : ${pluralize(stats.trainingCount, "séance")} et ${pluralize(stats.matchCount, "match", "matchs")} (${pluralize(
      stats.matchesPlayed,
      "joué",
      "joués",
    )}, ${stats.matchesScheduled} à venir).`,
  );
  if (stats.tournamentCount > 0 || stats.plateauCount > 0) {
    lines.push(`${pluralize(stats.tournamentCount, "tournoi")} et ${pluralize(stats.plateauCount, "plateau", "plateaux")}.`);
  }
  if (stats.trainingAttendance.total > 0) {
    lines.push(
      `Présence moyenne à l’entraînement : ${stats.trainingAttendance.rate}% (${stats.trainingAttendance.present} présences sur ${stats.trainingAttendance.total} relevées).`,
    );
  } else {
    lines.push("Aucune présence n’a encore été relevée à l’entraînement (elle se saisit à la préparation d’une séance).");
  }
  if (stats.matchAttendance.total > 0) {
    lines.push(`Présence moyenne en match : ${stats.matchAttendance.rate}%.`);
  }
  return lines;
}
