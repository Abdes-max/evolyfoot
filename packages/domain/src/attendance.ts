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
  // Précision libre laissée par le joueur/tuteur en répondant à une convocation (motif détaillé
  // d'une absence). Jamais renseigné pour une entrée saisie par le coach lui-même.
  readonly comment?: string | null;
  // Présence posée automatiquement à l’envoi de la convocation (équipe réglée sur « présent par
  // défaut ») : le joueur n’a pas encore répondu lui-même.
  readonly byDefault?: boolean;
}

export function createAttendanceEntry(playerId: string, playerName: string, status: AttendanceStatus, comment?: string | null): AttendanceEntry {
  return Object.freeze({ playerId, playerName, status, present: isPresentStatus(status), comment: comment ?? null });
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

// Correction de présence saisie par l'éducateur une fois l'événement terminé.
export interface AttendanceUpdate {
  readonly playerId: string;
  readonly status: AttendanceStatus;
  readonly comment?: string | null;
}

export const maxAttendanceCommentLength = 200;

// Valide les corrections reçues et les transforme en entrées de présence. Le nom du joueur vient de
// l'effectif, jamais de la requête. Le commentaire (motif libre) n'est gardé que pour un statut
// autre que « présent ». Lève une Error métier (message pour l'éducateur).
export function buildAttendanceEntries(updates: unknown, players: ReadonlyArray<{ readonly id: string; readonly name: string }>): AttendanceEntry[] {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("Indique la présence d'au moins un joueur.");
  }
  const names = new Map(players.map((player) => [player.id, player.name]));
  const seen = new Set<string>();
  return updates.map((raw: unknown) => {
    const update = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const playerId = update.playerId;
    const status = update.status;
    if (typeof playerId !== "string" || !names.has(playerId)) {
      throw new Error("Un des joueurs ne fait pas partie des joueurs concernés.");
    }
    if (seen.has(playerId)) {
      throw new Error("Un joueur est indiqué deux fois.");
    }
    seen.add(playerId);
    if (typeof status !== "string" || !(attendanceStatuses as readonly string[]).includes(status)) {
      throw new Error("Statut de présence inconnu.");
    }
    const comment = typeof update.comment === "string" ? update.comment.trim() : "";
    if (comment.length > maxAttendanceCommentLength) {
      throw new Error(`Le commentaire est trop long (${maxAttendanceCommentLength} caractères maximum).`);
    }
    const keepsComment = status !== "present";
    return createAttendanceEntry(playerId, names.get(playerId) as string, status as AttendanceStatus, keepsComment && comment ? comment : null);
  });
}

// Remplace les entrées des joueurs corrigés et garde les autres telles quelles.
export function mergeAttendance(existing: ReadonlyArray<AttendanceEntry> | undefined, corrections: ReadonlyArray<AttendanceEntry>): AttendanceEntry[] {
  const corrected = new Set(corrections.map((entry) => entry.playerId));
  return [...(existing ?? []).filter((entry) => !corrected.has(entry.playerId)), ...corrections];
}
