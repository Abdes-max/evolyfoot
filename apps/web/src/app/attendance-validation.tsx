"use client";

import { attendanceStatusLabels, attendanceStatusOf, summarizeTrainingResponses, type AttendanceEntry, type AttendanceStatus } from "@evolyfoot/domain";
import { useState } from "react";

type Choice = "present" | "late" | "absent";

// Les motifs d'absence : « Absent » sans précision, ou l'un des trois motifs.
const absenceStatuses: readonly AttendanceStatus[] = ["absent", "sick", "injured", "personal"];

function choiceOf(status: AttendanceStatus): Choice {
  return status === "present" ? "present" : status === "late" ? "late" : "absent";
}

interface Row {
  status: AttendanceStatus;
  comment: string;
}

function initialRows(players: readonly { id: string }[], attendance: readonly AttendanceEntry[] | undefined): Record<string, Row> {
  const rows: Record<string, Row> = {};
  for (const player of players) {
    const entry = attendance?.find((candidate) => candidate.playerId === player.id);
    rows[player.id] = { status: entry ? attendanceStatusOf(entry) : "present", comment: entry?.comment ?? "" };
  }
  return rows;
}

// Validation des présences une fois l'événement terminé : l'éducateur confirme ou corrige, joueur par
// joueur, présent / en retard / absent (avec le motif). La saisie remplace la réponse du joueur.
export function AttendanceValidation({
  url,
  players,
  attendance,
  onSaved,
}: {
  // `PUT .../attendance` de l'événement (séance, match, tournoi ou plateau).
  url: string;
  players: readonly { id: string; name: string }[];
  attendance: readonly AttendanceEntry[] | undefined;
  // Reçoit le corps de la réponse (l'événement mis à jour).
  onSaved: (body: Record<string, unknown>) => void;
}) {
  const [rows, setRows] = useState(() => initialRows(players, attendance));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  if (players.length === 0) {
    return null;
  }

  const entries = players.map((player) => ({ playerId: player.id, playerName: player.name, status: rows[player.id]?.status ?? "present" }));
  const present = entries.filter((entry) => entry.status === "present").length;
  const late = entries.filter((entry) => entry.status === "late").length;
  const absent = entries.length - present - late;

  function update(playerId: string, patch: Partial<Row>) {
    setRows((current) => ({ ...current, [playerId]: { ...(current[playerId] as Row), ...patch } }));
    setMessage("");
  }

  function choose(playerId: string, choice: Choice) {
    update(playerId, { status: choice === "absent" ? "absent" : choice });
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attendance: players.map((player) => {
            const row = rows[player.id] as Row;
            return { playerId: player.id, status: row.status, comment: row.status === "present" ? null : row.comment };
          }),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setFailed(true);
        setMessage(typeof body?.error === "string" ? body.error : "L’enregistrement a échoué, réessaie.");
        return;
      }
      setMessage("Présences enregistrées.");
      onSaved(body ?? {});
    } catch {
      setFailed(true);
      setMessage("L’enregistrement a échoué, réessaie.");
    } finally {
      setSaving(false);
    }
  }

  const responses = summarizeTrainingResponses(players, attendance);

  return (
    <div className="attendance-validation">
      <h3>Valider les présences</h3>
      <p className="attendance-validation-hint">
        {responses.pending.length > 0
          ? `${responses.pending.length} joueur${responses.pending.length > 1 ? "s" : ""} sans réponse, présent${responses.pending.length > 1 ? "s" : ""} par défaut ici : corrige si besoin.`
          : "Confirme ou corrige la présence de chaque joueur."}
      </p>
      <ul className="attendance-validation-list">
        {players.map((player) => {
          const row = rows[player.id] as Row;
          const choice = choiceOf(row.status);
          return (
            <li className="attendance-validation-row" key={player.id}>
              <span className="attendance-validation-name">{player.name}</span>
              <div aria-label={`Présence de ${player.name}`} className="attendance-validation-choices" role="group">
                {(["present", "late", "absent"] as const).map((option) => (
                  <button
                    aria-pressed={choice === option}
                    className={`attendance-choice ${option}${choice === option ? " is-active" : ""}`}
                    key={option}
                    onClick={() => choose(player.id, option)}
                    type="button"
                  >
                    {option === "absent" ? "Absent" : attendanceStatusLabels[option]}
                  </button>
                ))}
              </div>
              {choice === "absent" && (
                <select
                  aria-label={`Motif d’absence de ${player.name}`}
                  className="attendance-validation-reason"
                  onChange={(event) => update(player.id, { status: event.target.value as AttendanceStatus })}
                  value={row.status}
                >
                  {absenceStatuses.map((status) => (
                    <option key={status} value={status}>
                      {attendanceStatusLabels[status]}
                    </option>
                  ))}
                </select>
              )}
              {choice !== "present" && (
                <input
                  aria-label={`Précision pour ${player.name}`}
                  className="attendance-validation-comment"
                  maxLength={200}
                  onChange={(event) => update(player.id, { comment: event.target.value })}
                  placeholder={choice === "late" ? "Précision (facultatif)" : "Précision sur l’absence (facultatif)"}
                  value={row.comment}
                />
              )}
            </li>
          );
        })}
      </ul>
      <p className="attendance-validation-summary">
        {present} présent{present > 1 ? "s" : ""} · {late} en retard · {absent} absent{absent > 1 ? "s" : ""}
      </p>
      <button className="match-details-save" disabled={saving} onClick={() => void save()} type="button">
        {saving ? "Enregistrement…" : "Valider les présences"}
      </button>
      {message && (
        <p className={failed ? "field-error" : "match-convocation-feedback"} role={failed ? "alert" : "status"}>
          {message}
        </p>
      )}
    </div>
  );
}
