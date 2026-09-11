"use client";

import { attendanceStatusLabels, type AttendanceStatus } from "@evolyfoot/domain";
import Link from "next/link";
import { PlayerSpaceHeader } from "../../player-space-header";
import { usePlayerDashboard } from "../use-player-dashboard";
import { WeekCalendar } from "../week-calendar";

const venueLabel = { home: "Domicile", away: "Extérieur" } as const;

// Réponse à une convocation, résumée en un badge de couleur : orange tant que rien n'est
// renseigné, vert pour "Présent", rouge pour toute autre réponse (Absent, mais aussi Malade/
// Blessé/Raison personnelle/En retard) -- avec le motif précis affiché en dessous, comme demandé.
// N'est appelé que pour un match où le joueur est convoqué -- voir le filtre juste avant le rendu
// de la liste ci-dessous : ne pas être convoqué signifie ne pas apparaître du tout dans "Mes
// convocations", pas y apparaître grisé.
function ResponseBadge({ status }: { status: AttendanceStatus | null }) {
  if (status === null) {
    return <span className="response-badge response-badge--pending">En attente de réponse</span>;
  }
  if (status === "present") {
    return <span className="response-badge response-badge--present">Présent</span>;
  }
  return (
    <span className="response-badge response-badge--absent">
      Absent
      <small>{attendanceStatusLabels[status]}</small>
    </span>
  );
}

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
              <h2>Mes séances</h2>
              {dashboard.trainingSessions.length === 0 ? (
                <p className="player-space-empty">Aucune séance programmée pour le moment.</p>
              ) : (
                <ul className="player-space-matches">
                  {dashboard.trainingSessions.map((session) => (
                    <li key={session.id}>
                      <Link className="player-space-match-link convoked" href={`/joueur/seances/${session.id}`}>
                        <strong>{session.title}</strong>
                        <span>{session.meetingTime ? `${session.dateLabel} · ${session.meetingTime}` : session.dateLabel}</span>
                        <ResponseBadge status={session.myStatus} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="player-space-block">
              <h2>Mes convocations</h2>
              {(() => {
                // Ne pas être convoqué à un match à venir n'est pas une "convocation" -- ces
                // matchs n'ont rien à faire dans cette liste (voir demande utilisateur).
                const convocations = dashboard.upcomingMatches.filter((match) => match.convoked);
                return convocations.length === 0 ? (
                  <p className="player-space-empty">Aucune convocation pour le moment.</p>
                ) : (
                  <ul className="player-space-matches">
                    {convocations.map((match) => (
                      <li key={match.id}>
                        <Link className="player-space-match-link convoked" href={`/joueur/matches/${match.id}`}>
                          <strong>{match.opponent}</strong>
                          <span>
                            {match.dateLabel} · {venueLabel[match.venue]}
                          </span>
                          <ResponseBadge status={match.myStatus} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                );
              })()}
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
