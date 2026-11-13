"use client";

import { attendanceStatusLabels, attendanceStatusOf, type AttendanceEntry, type AttendanceStatus } from "@evolyfoot/domain";
import { useState } from "react";

export interface AttendancePlayer {
  id: string;
  name: string;
  photo?: string | null;
}

// `null` : pas encore de réponse ni de validation.
type RowStatus = AttendanceStatus | null;

// Motifs d'une absence valide (justifiée).
const validAbsenceStatuses: readonly AttendanceStatus[] = ["sick", "injured", "personal"];

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

function initialRows(players: readonly AttendancePlayer[], attendance: readonly AttendanceEntry[] | undefined): Record<string, RowStatus> {
  const rows: Record<string, RowStatus> = {};
  for (const player of players) {
    const entry = attendance?.find((candidate) => candidate.playerId === player.id);
    rows[player.id] = entry ? attendanceStatusOf(entry) : null;
  }
  return rows;
}

function isParticipating(status: RowStatus): boolean {
  return status === "present" || status === "late";
}

// Une note existe quand le statut précise la présence ou l'absence : « En retard » ou une absence valide.
function noteLabel(status: RowStatus): string | null {
  if (status === "late") return attendanceStatusLabels.late;
  if (status && validAbsenceStatuses.includes(status)) return `Absence valide · ${attendanceStatusLabels[status]}`;
  return null;
}

function Avatar({ player }: { player: AttendancePlayer }) {
  return (
    <span aria-hidden="true" className="attendance-avatar">
      {player.photo ? <img alt="" src={player.photo} /> : initials(player.name)}
    </span>
  );
}

// Validation des présences une fois l'événement terminé : une carte résumé, puis un écran dédié
// (Annuler / Sauvegarder) qui regroupe les joueurs en « Ont participé », « Sans réponse » et « Absents ».
// La pastille à cocher confirme ou retire un joueur ; « + Note » ouvre « Absence valide » (avec son
// motif) ou « En retard ». La saisie remplace la réponse du joueur.
export function AttendanceValidation({
  url,
  players,
  attendance,
  onSaved,
}: {
  // `PUT .../attendance` de l'événement (séance, match, tournoi ou plateau).
  url: string;
  players: readonly AttendancePlayer[];
  attendance: readonly AttendanceEntry[] | undefined;
  // Reçoit le corps de la réponse (l'événement mis à jour).
  onSaved: (body: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() => initialRows(players, attendance));
  // Joueur dont on ajoute une note, et étape : choix racine ou motif d'absence valide.
  const [note, setNote] = useState<{ playerId: string; step: "root" | "motive" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  if (players.length === 0) {
    return null;
  }

  const statusOf = (player: AttendancePlayer): RowStatus => rows[player.id] ?? null;
  const participating = players.filter((player) => isParticipating(statusOf(player)));
  const pending = players.filter((player) => statusOf(player) === null);
  const declined = players.filter((player) => statusOf(player) !== null && !isParticipating(statusOf(player)));
  const late = participating.filter((player) => statusOf(player) === "late").length;
  const notePlayer = note ? players.find((player) => player.id === note.playerId) : undefined;

  function openSheet() {
    setRows(initialRows(players, attendance));
    setNote(null);
    setMessage("");
    setFailed(false);
    setOpen(true);
  }

  function setStatus(playerId: string, status: RowStatus) {
    setRows((current) => ({ ...current, [playerId]: status }));
  }

  function setEveryone(status: AttendanceStatus) {
    setRows(Object.fromEntries(players.map((player) => [player.id, status])));
  }

  async function save() {
    const updates = players.flatMap((player) => {
      const status = statusOf(player);
      return status === null ? [] : [{ playerId: player.id, status }];
    });
    if (updates.length === 0) {
      setFailed(true);
      setMessage("Coche au moins un joueur avant de sauvegarder.");
      return;
    }
    setSaving(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch(url, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ attendance: updates }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setFailed(true);
        setMessage(typeof body?.error === "string" ? body.error : "L’enregistrement a échoué, réessaie.");
        return;
      }
      setOpen(false);
      setMessage("Présences enregistrées.");
      onSaved(body ?? {});
    } catch {
      setFailed(true);
      setMessage("L’enregistrement a échoué, réessaie.");
    } finally {
      setSaving(false);
    }
  }

  function renderRow(player: AttendancePlayer) {
    const status = statusOf(player);
    const checked = isParticipating(status);
    const label = noteLabel(status);
    return (
      <li className="attendance-row" key={player.id}>
        <div className="attendance-row-main">
          <Avatar player={player} />
          <span className="attendance-row-name">
            {player.name}
            {label && <small className={`attendance-row-status ${status}`}>{label}</small>}
          </span>
          <button className="attendance-note-button" onClick={() => setNote({ playerId: player.id, step: "root" })} type="button">
            {label ? "Note" : "+ Note"}
          </button>
          <button
            aria-label={`${player.name} : ${checked ? "a participé, appuie pour le retirer" : "appuie pour confirmer sa participation"}`}
            aria-pressed={checked}
            className={`attendance-check${checked ? " is-checked" : ""}`}
            onClick={() => setStatus(player.id, checked ? "absent" : "present")}
            type="button"
          >
            <span aria-hidden="true">{checked ? "✓" : ""}</span>
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="attendance-validation">
      <h3>Présences</h3>
      <p className="attendance-validation-hint">
        {attendance?.length
          ? `${attendance.filter((entry) => entry.present).length} ont participé${late ? ` (dont ${late} en retard)` : ""}. Tu peux encore corriger.`
          : "L’événement est terminé : confirme qui était là."}
      </p>
      <button className="match-details-save" onClick={openSheet} type="button">
        Valider les présences
      </button>
      {message && !open && (
        <p className={failed ? "field-error" : "match-convocation-feedback"} role={failed ? "alert" : "status"}>
          {message}
        </p>
      )}

      {open && (
        <div aria-label="Validation des présences" aria-modal="true" className="attendance-sheet" role="dialog">
          <div className="attendance-sheet-panel">
            <header className="attendance-sheet-header">
              <button className="attendance-sheet-action" onClick={() => setOpen(false)} type="button">
                Annuler
              </button>
              <h2>Validation des présences</h2>
              <button className="attendance-sheet-action primary" disabled={saving} onClick={() => void save()} type="button">
                {saving ? "…" : "Sauvegarder"}
              </button>
            </header>
            {message && (
              <p className={failed ? "field-error" : "match-convocation-feedback"} role={failed ? "alert" : "status"}>
                {message}
              </p>
            )}
            <div className="attendance-sheet-body">
              <section>
                <div className="attendance-section-head">
                  <h3>Ont participé ({participating.length})</h3>
                  <button
                    className={`attendance-section-action${participating.length === players.length ? " danger" : ""}`}
                    onClick={() => setEveryone(participating.length === players.length ? "absent" : "present")}
                    type="button"
                  >
                    {participating.length === players.length ? "Tout retirer" : "Tout cocher"}
                  </button>
                </div>
                <ul className="attendance-list">{participating.map(renderRow)}</ul>
              </section>
              {pending.length > 0 && (
                <section>
                  <div className="attendance-section-head">
                    <h3>Sans réponse ({pending.length})</h3>
                  </div>
                  <ul className="attendance-list">{pending.map(renderRow)}</ul>
                </section>
              )}
              {declined.length > 0 && (
                <section>
                  <div className="attendance-section-head">
                    <h3>Absents ({declined.length})</h3>
                  </div>
                  <ul className="attendance-list">{declined.map(renderRow)}</ul>
                </section>
              )}
            </div>
          </div>

          {note && notePlayer && (
            <div className="attendance-action-sheet" onClick={() => setNote(null)} role="presentation">
              <div
                aria-label={`Note pour ${notePlayer.name}`}
                className="attendance-action-sheet-panel"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
              >
                <div className="attendance-action-group">
                  <p className="attendance-action-title">{note.step === "root" ? "Ajouter une note" : "Motif de l’absence valide"}</p>
                  {note.step === "root" ? (
                    <>
                      <button onClick={() => setNote({ playerId: notePlayer.id, step: "motive" })} type="button">
                        Absence valide
                      </button>
                      <button
                        onClick={() => {
                          setStatus(notePlayer.id, "late");
                          setNote(null);
                        }}
                        type="button"
                      >
                        En retard
                      </button>
                      {noteLabel(statusOf(notePlayer)) && (
                        <button
                          className="danger"
                          onClick={() => {
                            setStatus(notePlayer.id, isParticipating(statusOf(notePlayer)) ? "present" : "absent");
                            setNote(null);
                          }}
                          type="button"
                        >
                          Retirer la note
                        </button>
                      )}
                    </>
                  ) : (
                    validAbsenceStatuses.map((motive) => (
                      <button
                        key={motive}
                        onClick={() => {
                          setStatus(notePlayer.id, motive);
                          setNote(null);
                        }}
                        type="button"
                      >
                        {attendanceStatusLabels[motive]}
                      </button>
                    ))
                  )}
                </div>
                <button className="attendance-action-cancel" onClick={() => setNote(null)} type="button">
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
