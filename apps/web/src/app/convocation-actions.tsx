"use client";

import { concernedPlayers, convocationFeedback, playersWithoutResponse, type AttendanceEntry, type PlayerSelection } from "@evolyfoot/domain";
import { useState } from "react";
import { AttendanceValidation } from "./attendance-validation";
import { TrainingResponses } from "./training-responses";

// Réponses à la convocation d'un match, d'un tournoi ou d'un plateau, et son envoi, comme dans l'app
// Coach : une première fois à tous les joueurs concernés, puis en relance, à tous ou aux seuls
// joueurs qui n'ont pas encore répondu.
export function ConvocationActions({
  convokeUrl,
  convokedAt,
  meetingAt,
  attendance,
  selectedPlayerIds,
  roster,
  scheduledText,
  canSend,
  onSent,
  validateUrl,
  onAttendanceSaved,
}: {
  convokeUrl: string;
  convokedAt: string | null;
  meetingAt: string | null;
  attendance: readonly AttendanceEntry[] | undefined;
  selectedPlayerIds: PlayerSelection | undefined;
  roster: readonly { id: string; name: string }[];
  scheduledText: string;
  // Faux pour un événement passé : plus de convocation à envoyer.
  canSend: boolean;
  // Appelée après un envoi réussi : la fiche relit l'événement (date d'envoi, réponses).
  onSent: () => void | Promise<void>;
  // Événement terminé : `PUT .../attendance` pour valider ou corriger les présences (présent, en
  // retard, absent). Absent tant que l’événement n’est pas terminé ou s’il est annulé.
  validateUrl?: string;
  onAttendanceSaved?: (body: Record<string, unknown>) => void;
}) {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const concerned = concernedPlayers(roster, selectedPlayerIds ?? null);
  const pendingCount = playersWithoutResponse(concerned, attendance).length;

  async function send(onlyPending: boolean) {
    setSending(true);
    setStatus("");
    setFailed(false);
    try {
      const response = await fetch(convokeUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ onlyPending }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setFailed(true);
        setStatus(typeof body?.error === "string" ? body.error : "L’envoi a échoué, réessaie.");
        return;
      }
      setStatus(convocationFeedback(body?.sentCount ?? 0, body?.emailCount ?? 0));
      await onSent();
    } catch {
      setFailed(true);
      setStatus("L’envoi a échoué, réessaie.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="convocation-actions">
      <TrainingResponses
        attendance={attendance}
        convokedAt={convokedAt}
        meetingAt={meetingAt}
        roster={concerned}
        scheduledText={scheduledText}
        settings={null}
      />
      {canSend &&
        (convokedAt ? (
          <div className="convocation-actions-row">
            <button className="match-convocation-send" disabled={sending || pendingCount === 0} onClick={() => void send(true)} type="button">
              {sending ? "Envoi…" : pendingCount === 0 ? "Tout le monde a répondu" : `Renvoyer aux sans réponse (${pendingCount})`}
            </button>
            <button className="match-details-save" disabled={sending} onClick={() => void send(false)} type="button">
              Renvoyer à tous
            </button>
          </div>
        ) : (
          <button className="match-convocation-send" disabled={sending || concerned.length === 0} onClick={() => void send(false)} type="button">
            {sending ? "Envoi…" : `Envoyer la convocation (${concerned.length})`}
          </button>
        ))}
      {status && (
        <p className={failed ? "field-error" : "match-convocation-feedback"} role={failed ? "alert" : "status"}>
          {status}
        </p>
      )}
      {validateUrl && <AttendanceValidation attendance={attendance} onSaved={(body) => onAttendanceSaved?.(body)} players={concerned} url={validateUrl} />}
    </div>
  );
}
