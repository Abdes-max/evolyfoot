"use client";

import { useEffect, useState } from "react";
import type { AttendanceStatus, PlayerEvaluationScores, PlayerSeasonTotals } from "@evolyfoot/domain";

export interface Evaluation {
  id: string;
  scores: PlayerEvaluationScores;
  source?: "coach" | "player";
  createdAt: string;
}

export interface DashboardMatch {
  id: string;
  opponent: string;
  dateLabel: string;
  date: string | null;
  kickoffTime: string | null;
  meetingTime: string | null;
  location: string | null;
  description: string | null;
  venue: "home" | "away";
  convoked: boolean;
  myStatus: AttendanceStatus | null;
}

// Même principe que DashboardMatch, pour une séance d'entraînement -- toujours "convoquée"
// (voir PlayerDashboardTrainingSession côté base, il n'y a pas de composition pour une séance).
export interface DashboardTrainingSession {
  id: string;
  title: string;
  dateLabel: string;
  date: string | null;
  meetingTime: string | null;
  location: string | null;
  description: string | null;
  myStatus: AttendanceStatus | null;
  // Présence posée par défaut à la convocation, pas encore confirmée.
  myStatusByDefault?: boolean;
  // Convocation envoyée : avant, la séance est seulement « programmée », sans réponse possible.
  convoked?: boolean;
}

export interface Competition {
  id: string;
  type: "plateau" | "tournoi";
  name: string;
  dateLabel: string;
  date: string | null;
  location?: string | null;
  // Convocation envoyée : avant, l'événement est seulement « programmé », sans réponse possible.
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
  team: { name: string; ageGroup: string; trainingDays: string[] } | null;
  evaluations: Evaluation[];
  trainingAttendance: { present: number; absent: number; total: number; rate: number };
  matchAttendance: { present: number; absent: number; total: number; rate: number };
  upcomingMatches: DashboardMatch[];
  trainingSlots: { weekNumber: number; slot: number }[];
  trainingSessions: DashboardTrainingSession[];
  competitions: Competition[];
}

// Partagé par les deux onglets de l'espace joueur/tuteur (Mon enfant + Calendrier, voir
// player-tab-bar.tsx) : chacun refait son propre fetch au montage plutôt que de partager un état
// entre pages (Next.js démonte/remonte le composant de page à chaque navigation d'onglet -- pas
// de "layout persistant" ici qui justifierait un contexte), léger vu la taille de la réponse.
// Enfant dont la demande de suivi attend l'accord de l'éducateur.
export interface PendingChild {
  playerId: string;
  name: string;
  teamName: string | null;
  coachName: string | null;
}

export function usePlayerDashboard() {
  // "waiting" : aucune demande encore acceptée, rien à montrer de l'enfant.
  const [status, setStatus] = useState<"loading" | "ready" | "waiting" | "error">("loading");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [pending, setPending] = useState<PendingChild[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [response, childrenResponse] = await Promise.all([fetch("/api/joueur"), fetch("/api/joueur/enfants").catch(() => null)]);
        const body = await response.json().catch(() => ({ dashboard: null }));
        const childrenBody = childrenResponse?.ok ? await childrenResponse.json().catch(() => null) : null;
        if (cancelled) {
          return;
        }
        setPending(childrenBody?.pending ?? []);
        if (response.ok && body.dashboard) {
          setDashboard(body.dashboard);
          setStatus("ready");
        } else if (response.ok && body.waiting) {
          setStatus("waiting");
        } else {
          setStatus("error");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, dashboard, pending };
}

export async function playerLogout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "/connexion";
  }
}
