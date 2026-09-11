"use client";

import type { AttendanceStatus } from "@evolyfoot/domain";
import Link from "next/link";
import { useState } from "react";
import { ClockIcon, NoteIcon, PinIcon } from "../../../event-icons";
import { MapEmbed } from "../../../map-embed";
import { RsvpControl } from "../../../rsvp-control";
import { usePlayerDashboard } from "../../use-player-dashboard";

// Même principe que match-detail-view.tsx -- page de détail à part entière (pas un panneau
// superposé), sans barre de navigation (voir player-tab-bar.tsx), avec la même réponse binaire
// présent/absent + motif. Pas de "convoqué" ici : toute l'équipe est attendue par défaut à une
// séance, il n'y a pas de composition retenue comme pour un match.
export function TrainingSessionDetailView({ sessionId }: { sessionId: string }) {
  const { status, dashboard } = usePlayerDashboard();
  const [responding, setResponding] = useState(false);
  const [myStatusOverride, setMyStatusOverride] = useState<AttendanceStatus | null>(null);

  const found = dashboard?.trainingSessions.find((candidate) => candidate.id === sessionId);
  const session = found && myStatusOverride ? { ...found, myStatus: myStatusOverride } : found;

  async function respond(nextStatus: AttendanceStatus, comment: string | null) {
    if (!session) {
      return;
    }
    setResponding(true);
    setMyStatusOverride(nextStatus);
    try {
      await fetch("/api/joueur/rsvp-seance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, status: nextStatus, comment }),
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
        <Link className="player-space-logout" href="/joueur/calendrier">
          ← Retour
        </Link>
      </header>

      <main className="player-space-content">
        {status === "loading" && <p className="player-space-note">Chargement…</p>}
        {status === "error" && <p className="player-space-note">Impossible de charger cette séance.</p>}
        {status === "ready" && !session && <p className="player-space-note">Cette séance n’existe plus.</p>}

        {status === "ready" && session && (
          <section className="player-match-detail">
            <div className="player-match-detail-teams">
              {dashboard?.team && <strong>{dashboard.team.name}</strong>}
              <strong>{session.title}</strong>
            </div>

            <dl className="player-match-detail-facts">
              <div>
                <dt>
                  <ClockIcon /> Rendez-vous
                </dt>
                <dd>{session.meetingTime ? `${session.dateLabel} · ${session.meetingTime}` : session.dateLabel}</dd>
              </div>
              {session.location && (
                <div>
                  <dt>
                    <PinIcon /> Lieu
                  </dt>
                  <dd>{session.location}</dd>
                </div>
              )}
            </dl>

            {session.location && <MapEmbed address={session.location} />}

            {session.description && (
              <p className="player-match-detail-description">
                <NoteIcon /> {session.description}
              </p>
            )}

            <div className="player-match-detail-rsvp">
              <p>Ta réponse</p>
              <RsvpControl disabled={responding} onRespond={respond} status={session.myStatus} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
