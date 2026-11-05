import { attendanceStatusOf, type AttendanceEntry } from "./attendance";

// Réponse d'un joueur convoqué à un entraînement tant qu'il ne s'est pas manifesté.
export type AttendanceDefault = "present" | "ask";

export interface TrainingConvocationSettings {
  // Jours avant le rendez-vous où la convocation part toute seule : 0 = dès la création de la
  // séance, `null` = l'éducateur l'envoie lui-même.
  leadDays: number | null;
  // `null` tant que l'éducateur n'a pas fait son choix : l'appli le lui demande.
  attendanceDefault: AttendanceDefault | null;
}

export const convocationLeadOptions: readonly { value: number | null; label: string }[] = [
  { value: 0, label: "Dès la création de la séance" },
  { value: 1, label: "La veille" },
  { value: 2, label: "2 jours avant" },
  { value: 3, label: "3 jours avant" },
  { value: 7, label: "1 semaine avant" },
  { value: null, label: "Je les envoie moi-même" },
];

export const attendanceDefaultOptions: readonly { value: AttendanceDefault; label: string; hint: string }[] = [
  { value: "present", label: "Présent par défaut", hint: "Les joueurs signalent seulement leurs absences." },
  { value: "ask", label: "Toujours demander", hint: "Chaque joueur répond présent ou absent." },
];

export function isValidLeadDays(value: unknown): value is number | null {
  return value === null || convocationLeadOptions.some((option) => option.value === value);
}

export function isAttendanceDefault(value: unknown): value is AttendanceDefault {
  return value === "present" || value === "ask";
}

// La convocation automatique d'une séance est-elle à envoyer maintenant ? Jamais pour une séance
// déjà passée ni pour une équipe en envoi manuel.
export function convocationDue(meetingAt: Date, leadDays: number | null, now: Date): boolean {
  if (leadDays === null || meetingAt.getTime() <= now.getTime()) return false;
  return leadDays === 0 || meetingAt.getTime() - leadDays * 86_400_000 <= now.getTime();
}

// Jour où partira la convocation automatique (`null` en envoi manuel ou « dès la création »).
export function convocationSendDate(meetingAt: Date, leadDays: number | null): Date | null {
  return leadDays === null || leadDays === 0 ? null : new Date(meetingAt.getTime() - leadDays * 86_400_000);
}

export interface ResponsePlayer {
  readonly id: string;
  readonly name: string;
}

export interface TrainingResponses {
  readonly present: readonly AttendanceEntry[];
  readonly absent: readonly AttendanceEntry[];
  // Joueurs de l'effectif sans réponse (et sans présence par défaut).
  readonly pending: readonly ResponsePlayer[];
}

// Présents, absents et sans réponse d'une séance convoquée, pour l'effectif actuel (un joueur
// retiré depuis n'apparaît plus).
export function summarizeTrainingResponses(roster: readonly ResponsePlayer[], attendance: readonly AttendanceEntry[] | undefined): TrainingResponses {
  const byPlayer = new Map((attendance ?? []).map((entry) => [entry.playerId, entry]));
  const present: AttendanceEntry[] = [];
  const absent: AttendanceEntry[] = [];
  const pending: ResponsePlayer[] = [];
  for (const player of roster) {
    const entry = byPlayer.get(player.id);
    if (!entry) pending.push(player);
    else if (entry.present || attendanceStatusOf(entry) === "late") present.push({ ...entry, playerName: player.name });
    else absent.push({ ...entry, playerName: player.name });
  }
  return { present, absent, pending };
}
