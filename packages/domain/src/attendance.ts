// Présence à une séance ou un match. Même principe que MatchRecord.lineup côté base de données :
// le joueur est référencé par id + nom dupliqué, jamais par clé étrangère -- une présence reste la
// photo figée d'un jour donné, un joueur renommé ou retiré de l'effectif après coup ne doit pas la
// modifier.
export type AttendanceStatus = "present" | "sick" | "injured" | "personal" | "late" | "absent";

export const attendanceStatuses: readonly AttendanceStatus[] = ["present", "sick", "injured", "personal", "late", "absent"];

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  present: "Présent",
  sick: "Malade",
  injured: "Blessé",
  personal: "Raison personnelle",
  late: "En retard",
  absent: "Absent",
};

// Codes courts affichés dans les vues compactes (badges, cellules de calendrier).
export const attendanceStatusCodes: Record<AttendanceStatus, string> = {
  present: "1",
  sick: "M",
  injured: "BL",
  personal: "RP",
  late: "R",
  absent: "AB",
};

// Compte comme "présent" pour le calcul du taux (AttendanceSummary.rate) : arrivé en retard reste
// une présence effective à la séance/au match, contrairement aux quatre autres motifs d'absence.
function isPresentStatus(status: AttendanceStatus): boolean {
  return status === "present" || status === "late";
}

export interface AttendanceEntry {
  readonly playerId: string;
  readonly playerName: string;
  // Dérivé de `status` par createAttendanceEntry -- gardé pour ne pas casser les lecteurs
  // existants (résumés, donuts) qui n'ont besoin que d'un oui/non.
  readonly present: boolean;
  // Optionnel : absent sur une entrée créée avant l'introduction des motifs détaillés (simple
  // présent/absent). Un lecteur qui veut le détail retombe sur "present"/"absent" selon `present`.
  readonly status?: AttendanceStatus;
}

export function createAttendanceEntry(playerId: string, playerName: string, status: AttendanceStatus): AttendanceEntry {
  return Object.freeze({ playerId, playerName, status, present: isPresentStatus(status) });
}

// Le statut effectif d'une entrée, avec repli sur le binaire présent/absent pour les entrées
// créées avant l'introduction des motifs détaillés.
export function attendanceStatusOf(entry: Pick<AttendanceEntry, "present" | "status">): AttendanceStatus {
  return entry.status ?? (entry.present ? "present" : "absent");
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
