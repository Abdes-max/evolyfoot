"use client";

import { useState } from "react";

// Annuler un match, un tournoi ou un plateau : message facultatif aux joueurs concernés, puis « Rétablir » pour
// revenir en arrière (sans nouveau message). `url` : `POST` annule, `DELETE` rétablit.
export function CancelEventPanel({
  url,
  noun,
  cancelledAt,
  cancellationNote,
  onChange,
}: {
  url: string;
  // « le match », « ce tournoi »… : sert au libellé du bouton et au message de confirmation.
  noun: string;
  cancelledAt: string | null | undefined;
  cancellationNote: string | null | undefined;
  onChange: (state: { cancelledAt: string | null; cancellationNote: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback(typeof body.error === "string" ? body.error : "Une erreur est survenue.");
        return;
      }
      onChange({ cancelledAt: new Date().toISOString(), cancellationNote: note.trim() || null });
      setOpen(false);
      setFeedback(
        body.sentCount > 0
          ? `Annulé : ${body.sentCount} joueur${body.sentCount > 1 ? "s" : ""} prévenu${body.sentCount > 1 ? "s" : ""}.`
          : "Annulé. Aucun message envoyé : la convocation n’était pas partie.",
      );
    } catch {
      setFeedback("Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) {
        setFeedback("Une erreur est survenue.");
        return;
      }
      onChange({ cancelledAt: null, cancellationNote: null });
      setNote("");
      setFeedback("Rétabli. Renvoie la convocation pour en informer les joueurs.");
    } catch {
      setFeedback("Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="session-cancel">
      {cancelledAt ? (
        <>
          <p className="session-cancel-state" role="status">
            Annulé{cancellationNote ? ` : ${cancellationNote}` : ""}.
          </p>
          <button disabled={busy} onClick={restore} type="button">
            {busy ? "…" : "Rétablir"}
          </button>
        </>
      ) : open ? (
        <>
          <label>
            <span>Message aux joueurs (facultatif)</span>
            <textarea
              maxLength={300}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex. Terrain impraticable, on vous tient au courant."
              value={note}
            />
          </label>
          <p className="match-slot-hint">Les joueurs concernés reçoivent un message d’annulation (et un e-mail s’ils ont une adresse).</p>
          <div>
            <button className="session-cancel-confirm" disabled={busy} onClick={cancel} type="button">
              {busy ? "Annulation…" : "Confirmer l’annulation"}
            </button>
            <button disabled={busy} onClick={() => setOpen(false)} type="button">
              Garder
            </button>
          </div>
        </>
      ) : (
        <button className="session-cancel-open" onClick={() => setOpen(true)} type="button">
          Annuler {noun}
        </button>
      )}
      {feedback && <p className="match-convocation-feedback">{feedback}</p>}
    </div>
  );
}
