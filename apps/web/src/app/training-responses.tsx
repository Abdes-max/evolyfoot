"use client";

import {
  attendanceStatusLabels,
  attendanceStatusOf,
  convocationSendDate,
  summarizeTrainingResponses,
  type AttendanceEntry,
  type ResponsePlayer,
  type TrainingConvocationSettings,
} from "@evolyfoot/domain";
import { useState } from "react";

type Tab = "present" | "absent" | "pending";

const tabLabels: Record<Tab, string> = { present: "Présents", absent: "Absents", pending: "Sans réponse" };

function dateLabel(date: Date): string {
  return date.toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

// Réponses à la convocation d'un entraînement, à la manière de Spond : trois compteurs (présents,
// absents, sans réponse), chacun ouvrant la liste des joueurs avec le motif d'absence. Avant
// l'envoi, rappelle quand la convocation partira.
export function TrainingResponses({
  roster,
  attendance,
  convokedAt,
  meetingAt,
  settings,
  scheduledText,
}: {
  roster: readonly ResponsePlayer[];
  attendance: readonly AttendanceEntry[] | undefined;
  convokedAt: string | null;
  meetingAt: string | null;
  settings: TrainingConvocationSettings | null;
  // Texte affiché avant l'envoi, à la place de celui des séances (tournoi, plateau).
  scheduledText?: string;
}) {
  const [tab, setTab] = useState<Tab | null>(null);

  if (!convokedAt) {
    const sendDate = meetingAt ? convocationSendDate(new Date(meetingAt), settings?.leadDays ?? null) : null;
    return (
      <div className="training-responses scheduled">
        <span className="training-responses-badge">Programmée</span>
        <p>
          {scheduledText
            ? scheduledText
            : settings?.leadDays === null || settings?.leadDays === undefined
              ? "Les joueurs voient la séance sans pouvoir répondre tant que tu n’as pas envoyé la convocation."
              : sendDate
                ? `La convocation partira automatiquement ${dateLabel(sendDate)}.`
                : "La convocation part automatiquement dans les prochaines minutes."}
        </p>
      </div>
    );
  }

  const responses = summarizeTrainingResponses(roster, attendance);
  const counts: Record<Tab, number> = { present: responses.present.length, absent: responses.absent.length, pending: responses.pending.length };
  const shown = tab ?? null;

  return (
    <div className="training-responses">
      <p className="training-responses-sent">Convocation envoyée {dateLabel(new Date(convokedAt))}</p>
      <div className="training-responses-counts" role="tablist">
        {(Object.keys(tabLabels) as Tab[]).map((key) => (
          <button
            aria-selected={shown === key}
            className={`training-responses-count ${key}${shown === key ? " is-active" : ""}`}
            key={key}
            onClick={() => setTab(shown === key ? null : key)}
            role="tab"
            type="button"
          >
            <strong>{counts[key]}</strong>
            <span>{tabLabels[key]}</span>
          </button>
        ))}
      </div>
      {shown && (
        <ul className="training-responses-list" role="tabpanel">
          {shown === "pending"
            ? responses.pending.map((player) => (
                <li key={player.id}>
                  <span className="training-responses-avatar">{player.name.charAt(0)}</span>
                  <strong>{player.name}</strong>
                  <small>Pas encore répondu</small>
                </li>
              ))
            : responses[shown].map((entry) => {
                const status = attendanceStatusOf(entry);
                return (
                  <li key={entry.playerId}>
                    <span className={`training-responses-avatar ${shown}`}>{entry.playerName.charAt(0)}</span>
                    <strong>{entry.playerName}</strong>
                    <small>
                      {entry.byDefault ? "Présent par défaut" : attendanceStatusLabels[status]}
                      {entry.comment ? ` · « ${entry.comment} »` : ""}
                    </small>
                  </li>
                );
              })}
          {counts[shown] === 0 && <li className="training-responses-empty">Personne pour l’instant.</li>}
        </ul>
      )}
    </div>
  );
}
