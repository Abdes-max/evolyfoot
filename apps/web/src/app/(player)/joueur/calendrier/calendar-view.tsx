"use client";

import { attendanceStatusLabels } from "@evolyfoot/domain";
import Link from "next/link";
import { PlayerSpaceHeader } from "../../player-space-header";
import { usePlayerDashboard } from "../use-player-dashboard";
import { WeekCalendar } from "../week-calendar";

const venueLabel = { home: "Domicile", away: "Extérieur" } as const;

// Onglet "Calendrier" (voir player-tab-bar.tsx) : la semaine, les convocations aux matchs et les
// compétitions -- tout ce qui décrit ce qui se passe, plutôt que ce qui décrit le joueur lui-même
// (voir l'onglet Mon enfant, player-dashboard-view.tsx).
export function PlayerCalendarView() {
  const { status, dashboard } = usePlayerDashboard();

  return (
    <div className="player-space">
      <PlayerSpaceHeader />

      <main className="player-space-content">
        {status === "loading" && <p className="player-space-note">Chargement…</p>}
        {status === "error" && <p className="player-space-note">Impossible de charger le calendrier pour le moment.</p>}

        {status === "ready" && dashboard && (
          <>
            {dashboard.team && dashboard.team.trainingDays.length > 0 && (
              <section className="player-space-block">
                <h2>Calendrier de la semaine</h2>
                <WeekCalendar dashboard={dashboard} />
              </section>
            )}

            <section className="player-space-block">
              <h2>Mes convocations</h2>
              {dashboard.upcomingMatches.length === 0 ? (
                <p className="player-space-empty">Aucun match à venir.</p>
              ) : (
                <ul className="player-space-matches">
                  {dashboard.upcomingMatches.map((match) => (
                    <li key={match.id}>
                      <Link className={match.convoked ? "player-space-match-link convoked" : "player-space-match-link"} href={`/joueur/matches/${match.id}`}>
                        <strong>{match.opponent}</strong>
                        <span>
                          {match.dateLabel} · {venueLabel[match.venue]}
                        </span>
                        <span className="player-space-tag">
                          {match.myStatus
                            ? `Réponse : ${attendanceStatusLabels[match.myStatus]}`
                            : match.convoked
                              ? "Convoqué"
                              : "Pas encore dans le groupe"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="player-space-block">
              <h2>Compétitions</h2>
              {dashboard.competitions.length === 0 ? (
                <p className="player-space-empty">Aucune compétition enregistrée.</p>
              ) : (
                <ul className="player-space-matches">
                  {dashboard.competitions.map((competition) => (
                    <li className="player-space-card" key={competition.id}>
                      <strong>{competition.name}</strong>
                      <span>{competition.dateLabel}</span>
                      <span className="player-space-tag">{competition.type === "plateau" ? "Plateau" : "Tournoi"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
