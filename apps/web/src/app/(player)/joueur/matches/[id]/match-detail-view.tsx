"use client";

import { attendanceStatusLabels, attendanceStatuses, type AttendanceStatus } from "@evolyfoot/domain";
import Link from "next/link";
import { useState } from "react";
import { usePlayerDashboard } from "../../use-player-dashboard";

const venueLabel = { home: "Match à domicile", away: "Match à l’extérieur" } as const;

export function MatchDetailView({ matchId }: { matchId: string }) {
  const { status, dashboard } = usePlayerDashboard();
  const [responding, setResponding] = useState(false);
  // Réponse déjà envoyée pendant cette visite de page, en attendant qu'un rechargement la
  // confirme -- le dashboard partagé (usePlayerDashboard) est en lecture seule, cette carte se
  // contente donc de superposer la dernière réponse choisie par-dessus la valeur reçue du serveur.
  const [myStatusOverride, setMyStatusOverride] = useState<AttendanceStatus | null>(null);

  const found = dashboard?.upcomingMatches.find((candidate) => candidate.id === matchId);
  const match = found && myStatusOverride ? { ...found, myStatus: myStatusOverride } : found;

  async function respond(nextStatus: AttendanceStatus) {
    if (!match) {
      return;
    }
    setResponding(true);
    // Optimiste -- même principe que le reste de l'espace joueur (player-dashboard-view.tsx).
    setMyStatusOverride(nextStatus);
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
