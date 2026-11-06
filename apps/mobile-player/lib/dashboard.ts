import type { AttendanceStatus, PlayerEvaluationScores, PlayerSeasonTotals } from "@evolyfoot/domain";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { apiFetch } from "./api";
import { useAuth } from "./auth-context";

export interface Evaluation {
  id: string;
  scores: PlayerEvaluationScores;
  source?: "coach" | "player";
  createdAt: string;
}

export interface UpcomingMatch {
  id: string;
  opponent: string;
  dateLabel: string;
  date: string | null;
  kickoffTime: string | null;
  meetingTime: string | null;
  location: string | null;
  convoked: boolean;
  myStatus: AttendanceStatus | null;
}

export interface TrainingSession {
  id: string;
  title: string;
  dateLabel: string;
  date: string | null;
  meetingTime: string | null;
  location: string | null;
  myStatus: AttendanceStatus | null;
  // Présence posée par défaut à la convocation, pas encore confirmée.
  myStatusByDefault?: boolean;
  // Convocation envoyée : avant, la séance est seulement « programmée », sans réponse possible.
  convoked?: boolean;
}

// Tournoi ou plateau : réponse possible une fois la convocation envoyée, comme une séance.
export interface Competition {
  id: string;
  type: "plateau" | "tournoi";
  name: string;
  dateLabel: string;
  date: string | null;
  location?: string | null;
  convoked?: boolean;
  myStatus?: AttendanceStatus | null;
}

export interface Dashboard {
  player: {
    id: string;
    name: string;
    photo: string | null;
    position: string | null;
    jerseyNumber: string | null;
    preferredFoot: string | null;
  };
  season: PlayerSeasonTotals;
  team: { name: string; ageGroup: string } | null;
  evaluations: Evaluation[];
  trainingAttendance: { rate: number; total: number };
  matchAttendance: { rate: number; total: number };
  upcomingMatches: UpcomingMatch[];
  pastMatches?: UpcomingMatch[];
  trainingSessions: TrainingSession[];
  competitions?: Competition[];
}

export interface AgendaEvent {
  key: string;
  kind: "match" | "training" | "tournament" | "plateau";
  id: string;
  title: string;
  dateLabel: string;
  time: string | null;
  location: string | null;
  date: string | null;
  myStatus: AttendanceStatus | null;
  // Un joueur hors de la composition n'a pas à répondre pour ce match ; une séance pas encore
  // convoquée est seulement « programmée ».
  canRespond: boolean;
  byDefault: boolean;
}

// Matchs et séances à venir, du plus proche au plus lointain. Un événement sans date réelle ferme
// la liste plutôt que de disparaître.
export function buildAgenda(dashboard: Dashboard, now: number, scope: "upcoming" | "past" = "upcoming"): AgendaEvent[] {
  const events: AgendaEvent[] = [
    ...[...dashboard.upcomingMatches, ...(dashboard.pastMatches ?? [])].map((match) => ({
      key: `match-${match.id}`,
      kind: "match" as const,
      id: match.id,
      title: `Match contre ${match.opponent}`,
      dateLabel: match.dateLabel,
      time: match.meetingTime ?? match.kickoffTime,
      location: match.location,
      date: match.date,
      myStatus: match.myStatus,
      canRespond: match.convoked,
      byDefault: false,
    })),
    ...dashboard.trainingSessions.map((session) => ({
      key: `training-${session.id}`,
      kind: "training" as const,
      id: session.id,
      title: session.title,
      dateLabel: session.dateLabel,
      time: session.meetingTime,
      location: session.location,
      date: session.date,
      myStatus: session.myStatus,
      canRespond: session.convoked !== false,
      byDefault: session.myStatusByDefault === true,
    })),
    ...(dashboard.competitions ?? []).map((competition) => ({
      key: `competition-${competition.id}`,
      kind: competition.type === "plateau" ? ("plateau" as const) : ("tournament" as const),
      id: competition.id,
      title: competition.name,
      dateLabel: competition.dateLabel,
      time: null,
      location: competition.location ?? null,
      date: competition.date,
      myStatus: competition.myStatus ?? null,
      canRespond: competition.convoked === true,
      byDefault: false,
    })),
  ];
  if (scope === "past") {
    return events
      .filter((event) => event.date && new Date(event.date).getTime() < now)
      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());
  }
  return events
    .filter((event) => !event.date || new Date(event.date).getTime() >= now)
    .sort((a, b) => (a.date ? new Date(a.date).getTime() : Infinity) - (b.date ? new Date(b.date).getTime() : Infinity));
}

// Fin de la semaine en cours (dimanche soir) : « Ma carte » n’affiche que ce qui tombe d’ici là.
export function endOfCurrentWeek(now: number): number {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
  return end.getTime();
}

// Convocations à venir encore sans réponse : pastille de l’onglet Calendrier.
export function pendingResponses(dashboard: Dashboard, now: number): number {
  return buildAgenda(dashboard, now).filter((event) => event.canRespond && event.myStatus === null).length;
}

export function useDashboard() {
  const { sessionToken } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  // "waiting" : aucune demande de suivi encore acceptée par l'éducateur.
  const [status, setStatus] = useState<"loading" | "ready" | "waiting" | "error">("loading");

  const reload = useCallback(async () => {
    const response = await apiFetch("/api/joueur", { sessionToken }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (response?.ok && body?.dashboard) {
      setDashboard(body.dashboard);
      setStatus("ready");
    } else if (response?.ok && body?.waiting) {
      setDashboard(null);
      setStatus("waiting");
    } else {
      setStatus("error");
    }
  }, [sessionToken]);

  // Relu à chaque retour sur l'écran : l'éducateur a peut-être publié une évaluation ou un match.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { dashboard, status, reload };
}
