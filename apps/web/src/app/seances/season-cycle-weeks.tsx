"use client";

import { isPastSeasonSlot, seasonSlotColor, seasonSlotDateLabel, type SeasonCycle, type SessionScope, type TrainingDay } from "@evolyfoot/domain";
import Link from "next/link";
import { slotLabel } from "../saison/guided-season";

interface PreparedSession {
  id: string;
  title: string;
  weekNumber: number;
  slot: number;
  blocks: ReadonlyArray<{ durationMinutes: number }>;
  meetingAt?: string | null;
  convokedAt?: string | null;
  attendance?: ReadonlyArray<{ present: boolean }>;
}

function weekDates(startDate: string, seasonWeek: number): string {
  const monday = new Date(`${startDate}T00:00:00`);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + (seasonWeek - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (date: Date) => date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${format(monday)} – ${format(sunday)}`;
}

function responsesLabel(session: PreparedSession): string {
  if (!session.convokedAt) return "Programmée";
  const present = (session.attendance ?? []).filter((entry) => entry.present).length;
  const absent = (session.attendance ?? []).length - present;
  return `${present} présent${present > 1 ? "s" : ""} · ${absent} absent${absent > 1 ? "s" : ""}`;
}

// Les 4 semaines d'un cycle de la saison guidée : chaque créneau reprend la séance prévue par la saison,
// aux couleurs de son thème, préparée (ouvre la séance) ou à préparer (ouvre sa fiche).
export function SeasonCycleWeeks({
  cycle,
  currentSeasonWeek,
  startDate,
  slotLabels,
  trainingDays,
  prepared,
  scope,
  now,
}: {
  cycle: SeasonCycle;
  currentSeasonWeek: number;
  startDate: string;
  slotLabels: readonly string[];
  trainingDays: readonly TrainingDay[];
  prepared: readonly PreparedSession[];
  scope: SessionScope;
  now: number;
}) {
  // Créneaux du filtre (à venir ou passés) ; une semaine sans créneau correspondant n'est pas affichée, les passées en premier la plus récente.
  const inScope = (weekNumber: number, index: number) =>
    isPastSeasonSlot({
      meetingAt: prepared.find((session) => session.weekNumber === weekNumber && session.slot === index)?.meetingAt,
      startDate,
      week: weekNumber,
      slot: index,
      trainingDays,
      currentWeek: currentSeasonWeek,
      now,
    }) ===
    (scope === "past");
  const weeks = cycle.weeks.filter((week) => week.slots.some((_, index) => inScope(week.seasonWeek, index)));
  if (scope === "past") weeks.reverse();
  if (weeks.length === 0) {
    return <p className="seances-hint">{scope === "past" ? "Aucune séance passée dans ce cycle." : "Aucune séance à venir dans ce cycle."}</p>;
  }
  return (
    <>
      {weeks.map((week) => (
        <article
          className={week.seasonWeek === currentSeasonWeek ? "seances-week active" : "seances-week"}
          key={week.seasonWeek}
          style={{ borderLeft: `4px solid ${seasonSlotColor(week.slots[0] ?? { type: "recreational", subTheme: null })}` }}
        >
          <header className="seances-week-head">
            <div>
              <span className="seances-week-number">S{week.seasonWeek}</span>
              <div>
                <h2>{week.intention}</h2>
                <p>
                  {weekDates(startDate, week.seasonWeek)} · {week.phase} · {week.theme}
                </p>
              </div>
            </div>
            {week.seasonWeek === currentSeasonWeek && <span className="seances-week-tag">Semaine en cours</span>}
          </header>
          <ul className="seances-slot-list">
            {week.slots.map((slot, index) => {
              if (!inScope(week.seasonWeek, index)) return null;
              const saved = prepared.find((session) => session.weekNumber === week.seasonWeek && session.slot === index);
              const color = seasonSlotColor(slot);
              return (
                <li className="seances-slot" key={index}>
                  <span className="seances-slot-label">
                    {trainingDays.length > 0
                      ? seasonSlotDateLabel(new Date(`${startDate}T00:00:00`), week.seasonWeek, index, trainingDays)
                      : (slotLabels[index] ?? `Séance ${index + 1}`)}
                  </span>
                  {saved ? (
                    <Link className="seances-slot-card generated" href={`/session/${saved.id}`} style={{ borderLeft: `4px solid ${color}` }}>
                      <strong>{saved.title}</strong>
                      <span style={{ color }}>
                        {slotLabel(slot)}
                        {slot.major ? " · prioritaire" : ""}
                      </span>
                      <span className={saved.convokedAt ? "seances-slot-responses" : "seances-slot-responses scheduled"}>{responsesLabel(saved)}</span>
                      <span className="seances-slot-cta">Ouvrir la séance →</span>
                    </Link>
                  ) : (
                    <Link
                      className="seances-slot-card pending"
                      href={`/saison/seance/${slot.sessionNumber}?semaine=${week.seasonWeek}&creneau=${index}`}
                      style={{ borderLeft: `4px solid ${color}` }}
                    >
                      <strong style={{ color }}>{slotLabel(slot)}</strong>
                      <span>
                        Séance {slot.sessionNumber} du programme{slot.major ? " · prioritaire" : ""}
                      </span>
                      <span className="seances-slot-cta">Préparer cette séance →</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </>
  );
}
