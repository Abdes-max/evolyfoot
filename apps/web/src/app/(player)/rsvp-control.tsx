"use client";

import { attendanceStatusLabels, attendanceStatuses, type AttendanceStatus } from "@evolyfoot/domain";
import { useState } from "react";

const absenceReasons = attendanceStatuses.filter((status) => status !== "present");

// Réponse à une convocation (match ou séance), simplifiée côté joueur/tuteur en un choix binaire
// Présent / Absent -- "Absent" ouvre une popup pour préciser le motif (repris des 6 statuts
// existants) et un commentaire libre à destination du coach, plutôt que d'exposer directement les
// 6 boutons de statut.
export function RsvpControl({
  status,
  disabled,
  onRespond,
}: {
  status: AttendanceStatus | null;
  disabled: boolean;
  onRespond: (status: AttendanceStatus, comment: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentReason = status && status !== "present" ? status : "absent";
  const [reason, setReason] = useState<AttendanceStatus>(currentReason);
  const [comment, setComment] = useState("");

  function openPopup() {
    setReason(currentReason);
    setComment("");
    setOpen(true);
  }

  function confirmAbsence() {
    onRespond(reason, comment.trim() ? comment.trim() : null);
    setOpen(false);
  }

  return (
    <div className="rsvp-control">
      <div className="rsvp-control-choices">
        <button
          aria-pressed={status === "present"}
          className={status === "present" ? "choice active" : "choice"}
          disabled={disabled}
          onClick={() => onRespond("present", null)}
          type="button"
        >
          Présent
        </button>
        <button
          aria-pressed={status !== null && status !== "present"}
          className={status !== null && status !== "present" ? "choice active absent" : "choice absent"}
          disabled={disabled}
          onClick={openPopup}
          type="button"
        >
          Absent
        </button>
      </div>

      {open && (
        <div className="rsvp-popup-backdrop" onClick={() => setOpen(false)}>
          <div className="rsvp-popup" onClick={(event) => event.stopPropagation()} role="dialog">
            <h3>Préciser l’absence</h3>
            <label className="rsvp-popup-field">
              <span>Motif</span>
              <select onChange={(event) => setReason(event.target.value as AttendanceStatus)} value={reason}>
                {absenceReasons.map((option) => (
                  <option key={option} value={option}>
                    {attendanceStatusLabels[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="rsvp-popup-field">
              <span>Commentaire pour le coach (facultatif)</span>
              <textarea
                onChange={(event) => setComment(event.target.value)}
                placeholder="Ex. de retour la semaine prochaine"
                rows={3}
                value={comment}
              />
            </label>
            <div className="rsvp-popup-actions">
              <button className="rsvp-popup-cancel" onClick={() => setOpen(false)} type="button">
                Annuler
              </button>
              <button className="rsvp-popup-confirm" onClick={confirmAbsence} type="button">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
