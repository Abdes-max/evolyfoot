"use client";

import { attendanceStatusLabels, type AttendanceStatus } from "@evolyfoot/domain";
import Link from "next/link";
import { useState } from "react";
import { RsvpControl } from "../../rsvp-control";
import { MapEmbed } from "../../../map-embed";
import { sortChronologically, weekGroupKey, weekGroupLabel } from "../../../date-format";
import { PlayerSpaceHeader } from "../../player-space-header";
import { usePlayerDashboard } from "../use-player-dashboard";
import { WeekCalendar } from "../week-calendar";

const venueLabel = { home: "Domicile", away: "Extérieur" } as const;

// Réponse à une convocation, résumée en un badge de couleur : orange tant que rien n'est
// renseigné, vert pour "Présent", rouge pour toute autre réponse (Absent, mais aussi Malade/
// Blessé/Raison personnelle/En retard) -- avec le motif précis affiché en dessous, comme demandé.
function ResponseBadge({ status, scheduled = false, byDefault = false }: { status: AttendanceStatus | null; scheduled?: boolean; byDefault?: boolean }) {
  if (scheduled) {
    return <span className="response-badge response-badge--scheduled">Programmée</span>;
  }
  if (status === "present" && byDefault) {
    return <span className="response-badge response-badge--present">Présent par défaut</span>;
  }
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

// Un seul bloc "Mes convocations", mêlant séances, matchs et compétitions dans l'ordre
// chronologique, regroupés par semaine -- voir la demande utilisateur ("finalement je veux un
// bloc convocations dedans mais dans l'ordre chronologique séances/match/compétitions"). Trois
// formes d'origine possibles, réduites ici à une forme commune juste pour le tri/l'affichage ;
// chacune garde son lien et son badge propres (une compétition n'a ni page de détail, ni réponse).
type CalendarItem =
  | {
      kind: "seance";
      id: string;
      date: Date | null;
      title: string;
      dateLabel: string;
      meetingTime: string | null;
      location: string | null;
      myStatus: AttendanceStatus | null;
      scheduled: boolean;
      byDefault: boolean;
    }
  | {
      kind: "match";
      id: string;
      date: Date | null;
      title: string;
      dateLabel: string;
      meetingTime: string | null;
      location: string | null;
      venue: "home" | "away";
      myStatus: AttendanceStatus | null;
    }
  | {
      kind: "competition";
      id: string;
      date: Date | null;
      title: string;
      dateLabel: string;
      type: "plateau" | "tournoi";
      location: string | null;
      convoked: boolean;
      myStatus: AttendanceStatus | null;
    };

// Réponse à la convocation d'un tournoi ou d'un plateau, directement sur la carte (pas de page de
// détail pour une compétition).
function CompetitionResponse({ item }: { item: Extract<CalendarItem, { kind: "competition" }> }) {
  const [status, setStatus] = useState<AttendanceStatus | null>(item.myStatus);
  const [responding, setResponding] = useState(false);

  async function respond(nextStatus: AttendanceStatus, comment: string | null) {
    setResponding(true);
    setStatus(nextStatus);
    try {
      await fetch("/api/joueur/rsvp-competition", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: item.type === "plateau" ? "plateau" : "tournament", competitionId: item.id, status: nextStatus, comment }),
      });
    } catch {
      // Repli silencieux, comme pour une séance : un rechargement confirmera ou corrigera.
    } finally {
      setResponding(false);
    }
  }

  if (!item.convoked) {
    return <ResponseBadge scheduled status={null} />;
  }
  return (
    <>
      <ResponseBadge status={status} />
      <RsvpControl disabled={responding} onRespond={respond} status={status} />
    </>
  );
}

// Onglet "Calendrier" (voir player-tab-bar.tsx) : la semaine, puis "Mes convocations" -- tout ce
// qui décrit ce qui se passe, plutôt que ce qui décrit le joueur lui-même (voir l'onglet Mon
// enfant, player-dashboard-view.tsx).
export function PlayerCalendarView() {
  const { status, dashboard } = usePlayerDashboard();

  const items: CalendarItem[] = dashboard
    ? [
        ...dashboard.trainingSessions.map((session): CalendarItem => ({
          kind: "seance",
          id: session.id,
          date: session.date ? new Date(session.date) : null,
          title: session.title,
          dateLabel: session.dateLabel,
          meetingTime: session.meetingTime,
          location: session.location,
          myStatus: session.myStatus,
          scheduled: session.convoked === false,
          byDefault: session.myStatusByDefault === true,
        })),
        // Ne pas être convoqué à un match à venir n'est pas une "convocation" -- ces matchs n'ont
        // rien à faire dans cette liste (voir demande utilisateur).
        ...dashboard.upcomingMatches
          .filter((match) => match.convoked)
          .map((match): CalendarItem => ({
            kind: "match",
            id: match.id,
            date: match.date ? new Date(match.date) : null,
            title: match.opponent,
            dateLabel: match.dateLabel,
            meetingTime: match.meetingTime,
            location: match.location,
            venue: match.venue,
            myStatus: match.myStatus,
          })),
        ...dashboard.competitions.map((competition): CalendarItem => ({
          kind: "competition",
          id: competition.id,
          date: competition.date ? new Date(competition.date) : null,
          title: competition.name,
          dateLabel: competition.dateLabel,
          type: competition.type,
          location: competition.location ?? null,
          convoked: competition.convoked === true,
          myStatus: competition.myStatus ?? null,
        })),
      ]
    : [];
  const sortedItems = sortChronologically(items, (item) => item.date);
  const today = new Date();

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
              {sortedItems.length === 0 ? (
                <p className="player-space-empty">Rien de prévu pour le moment.</p>
              ) : (
                (() => {
                  // Regroupées par semaine (clé stable) tout en gardant le titre calculé une
                  // seule fois par groupe -- voir weekGroupKey/weekGroupLabel.
                  const groups: { key: string; label: string; items: CalendarItem[] }[] = [];
                  for (const item of sortedItems) {
                    const key = item.date ? weekGroupKey(item.date) : "sans-date";
                    const label = item.date ? weekGroupLabel(item.date, today) : "Sans date";
                    const group = groups.at(-1);
                    if (group && group.key === key) {
                      group.items.push(item);
                    } else {
                      groups.push({ key, label, items: [item] });
                    }
                  }
                  return groups.map((group) => (
                    <div className="player-space-week-group" key={group.key}>
                      <h3>{group.label}</h3>
                      <ul className="player-space-matches">
                        {group.items.map((item) => {
                          if (item.kind === "competition") {
                            return (
                              <li className="player-space-card" key={`competition-${item.id}`}>
                                <strong>{item.title}</strong>
                                <span>{item.dateLabel}</span>
                                <span className="player-space-tag">{item.type === "plateau" ? "Plateau" : "Tournoi"}</span>
                                {item.location && <span>{item.location}</span>}
                                <CompetitionResponse item={item} />
                              </li>
                            );
                          }
                          const href = item.kind === "seance" ? `/joueur/seances/${item.id}` : `/joueur/matches/${item.id}`;
                          return (
                            <li key={`${item.kind}-${item.id}`}>
                              <Link className="player-space-match-link convoked" href={href}>
                                <strong>{item.title}</strong>
                                <span>
                                  {item.meetingTime ? `${item.dateLabel} · ${item.meetingTime}` : item.dateLabel}
                                  {item.kind === "match" ? ` · ${venueLabel[item.venue]}` : ""}
                                </span>
                                <ResponseBadge
                                  byDefault={item.kind === "seance" && item.byDefault}
                                  scheduled={item.kind === "seance" && item.scheduled}
                                  status={item.myStatus}
                                />
                              </Link>
                              {item.location && (
                                <div className="player-space-convocation-place">
                                  <p>{item.location}</p>
                                  <MapEmbed address={item.location} compact />
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ));
                })()
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
