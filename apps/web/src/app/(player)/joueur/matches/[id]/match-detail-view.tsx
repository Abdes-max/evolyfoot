"use client";

import { attendanceStatusLabels, attendanceStatuses, type AttendanceStatus } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";

interface DashboardMatch {
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

interface Dashboard {
  team: { name: string; ageGroup: string } | null;
  upcomingMatches: DashboardMatch[];
}

const venueLabel = { home: "Match à domicile", away: "Match à l’extérieur" } as const;

export function MatchDetailView({ matchId }: { matchId: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [responding, setResponding] = useState(false);

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

  const match = dashboard?.upcomingMatches.find((candidate) => candidate.id === matchId);

  async function respond(nextStatus: AttendanceStatus) {
    if (!match) {
      return;
    }
    setResponding(true);
    // Optimiste -- même principe que le reste de l'espace joueur (player-dashboard-view.tsx).
    setDashboard((current) =>
      current
        ? {
            ...current,
            upcomingMatches: current.upcomingMatches.map((candidate) =>
              candidate.id === matchId ? { ...candidate, myStatus: nextStatus } : candidate,
            ),
          }
        : current,
    );
    try {
      await fetch("/api/joueur/rsvp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchId, status: nextStatus }),
      });
    } catch {
      // Repli silencieux : une nouvelle tentative (ou un rechargement) confirmera ou corrigera.
    } finally {
      setResponding(false);
    }
  }

  return (
    <div className="player-space">
      <header className="player-space-header">
        <Link className="onboarding-brand" href="/joueur">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <Link className="player-space-logout" href="/joueur">
          ← Retour
        </Link>
      </header>

      <main className="player-space-content">
        {status === "loading" && <p className="player-space-note">Chargement…</p>}
        {status === "error" && <p className="player-space-note">Impossible de charger ce match.</p>}
        {status === "ready" && !match && <p className="player-space-note">Ce match n’existe plus.</p>}

        {status === "ready" && match && (
          <section className="player-match-detail">
            <div className="player-match-detail-teams">
              {dashboard?.team && <strong>{dashboard.team.name}</strong>}
              <strong>{match.opponent}</strong>
            </div>

            <p className="player-match-detail-venue">{venueLabel[match.venue]}</p>

            <dl className="player-match-detail-facts">
              <div>
                <dt>Rendez-vous</dt>
                <dd>{match.meetingTime ? `${match.dateLabel} · ${match.meetingTime}` : match.dateLabel}</dd>
              </div>
              {match.location && (
                <div>
                  <dt>Lieu</dt>
                  <dd>{match.location}</dd>
                </div>
              )}
            </dl>

            {match.description && <p className="player-match-detail-description">{match.description}</p>}

            <p className="player-space-tag">{match.convoked ? "Convoqué" : "Pas encore dans le groupe"}</p>

            <div className="player-match-detail-rsvp">
              <p>Ta réponse</p>
              <div className="player-match-detail-rsvp-options">
                {attendanceStatuses.map((option) => (
                  <button
                    aria-pressed={match.myStatus === option}
                    className={match.myStatus === option ? "choice active" : "choice"}
                    disabled={responding}
                    key={option}
                    onClick={() => respond(option)}
                    type="button"
                  >
                    {attendanceStatusLabels[option]}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
