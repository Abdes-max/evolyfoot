// Présence à une séance ou un match. Même principe que MatchRecord.lineup côté base de données :
// le joueur est référencé par id + nom dupliqué, jamais par clé étrangère -- une présence reste la
// photo figée d'un jour donné, un joueur renommé ou retiré de l'effectif après coup ne doit pas la
// modifier.
export interface AttendanceEntry {
  readonly playerId: string;
  readonly playerName: string;
  readonly present: boolean;
}

export interface AttendanceSummary {
  readonly present: number;
  readonly absent: number;
  readonly total: number;
  readonly rate: number;
}

export function summarizeAttendance(entries: ReadonlyArray<AttendanceEntry>): AttendanceSummary {
  const total = entries.length;
  const present = entries.filter((entry) => entry.present).length;
  return Object.freeze({
    present,
    absent: total - present,
    total,
    rate: total === 0 ? 0 : Math.round((present / total) * 100),
  });
}
