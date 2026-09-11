"use client";

import { useEffect, useState } from "react";
import type { AttendanceStatus, PlayerEvaluationScores } from "@evolyfoot/domain";

export interface Evaluation {
  id: string;
  scores: PlayerEvaluationScores;
  createdAt: string;
}

export interface DashboardMatch {
  id: string;
  opponent: string;
  dateLabel: string;
  meetingTime: string | null;
  location: string | null;
  description: string | null;
  venue: "home" | "away";
  convoked: boolean;
  myStatus: AttendanceStatus | null;
}

export interface Competition {
  id: string;
  type: "plateau" | "tournoi";
  name: string;
  dateLabel: string;
}

export interface Dashboard {
  player: { id: string; name: string; photo: string | null };
  team: { name: string; ageGroup: string; trainingDays: string[] } | null;
  evaluations: Evaluation[];
  trainingAttendance: { present: number; absent: number; total: number; rate: number };
  matchAttendance: { present: number; absent: number; total: number; rate: number };
  upcomingMatches: DashboardMatch[];
  trainingSlots: { weekNumber: number; slot: number }[];
  competitions: Competition[];
}

// Partagé par les deux onglets de l'espace joueur/tuteur (Mon enfant + Calendrier, voir
// player-tab-bar.tsx) : chacun refait son propre fetch au montage plutôt que de partager un état
// entre pages (Next.js démonte/remonte le composant de page à chaque navigation d'onglet -- pas
// de "layout persistant" ici qui justifierait un contexte), léger vu la taille de la réponse.
export function usePlayerDashboard() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/joueur");
        const body = await response.json().catch(() => ({ dashboard: null }));
        if (cancelled) {
          return;
        }
        if (response.ok && body.dashboard) {
          setDashboard(body.dashboard);
          setStatus("ready");
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

  return { status, dashboard };
}

export async function playerLogout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "/connexion";
  }
}
