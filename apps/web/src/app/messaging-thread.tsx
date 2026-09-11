"use client";

import type { MessageAuthorRole } from "@evolyfoot/domain";
import { useEffect, useState, type FormEvent } from "react";

interface ThreadMessage {
  id: string;
  authorRole: MessageAuthorRole;
  authorName: string;
  text: string;
  createdAt: string;
}

function formatTime(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Fil de discussion coach <-> joueur/tuteur, réutilisé des deux côtés (fiche joueur du coach,
// onglet Messages du joueur/tuteur) -- seuls `fetchUrl`/`sendUrl`/`viewerRole` changent. Pas de
// temps réel (websocket) pour cette première version : rechargé à l'ouverture et après envoi,
// avec un bouton "Actualiser" pour le reste.
export function MessagingThread({
  fetchUrl,
  sendUrl,
  viewerRole,
}: {
  fetchUrl: string;
  sendUrl: string;
  viewerRole: MessageAuthorRole;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(fetchUrl);
        const body = await response.json().catch(() => ({ messages: [] }));
        if (cancelled) {
          return;
        }
        if (response.ok) {
          setMessages(body.messages ?? []);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchUrl]);

  async function reload() {
    try {
      const response = await fetch(fetchUrl);
      const body = await response.json().catch(() => ({ messages: [] }));
      if (response.ok) {
        setMessages(body.messages ?? []);
      }
    } catch {
      // Repli silencieux : le fil affiché reste celui d'avant, l'utilisateur peut réessayer.
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const response = await fetch(sendUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setSendError(typeof body.error === "string" ? body.error : "Une erreur est survenue.");
        return;
      }
      setDraft("");
      await reload();
    } catch {
      setSendError("Une erreur est survenue.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="messaging-thread">
      {status === "loading" && <p className="messaging-note">Chargement…</p>}
      {status === "error" && <p className="messaging-note">Impossible de charger les messages.</p>}

      {status === "ready" &&
        (messages.length === 0 ? (
          <p className="messaging-empty">Aucun message pour le moment.</p>
        ) : (
          <ul className="messaging-list">
            {messages.map((message) => (
              <li className={message.authorRole === viewerRole ? "messaging-bubble mine" : "messaging-bubble"} key={message.id}>
                <span className="messaging-author">
                  {message.authorName} · {formatTime(message.createdAt)}
                </span>
                <p>{message.text}</p>
              </li>
            ))}
          </ul>
        ))}

      <form className="messaging-form" onSubmit={send}>
        <textarea
          disabled={sending}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Écris un message…"
          rows={2}
          value={draft}
        />
        <div className="messaging-form-actions">
          <button disabled={status === "loading" || sending} onClick={reload} type="button">
            Actualiser
          </button>
          <button disabled={sending || !draft.trim()} type="submit">
            {sending ? "…" : "Envoyer"}
          </button>
        </div>
        {sendError && (
          <p className="field-error" role="alert">
            {sendError}
          </p>
        )}
      </form>
    </div>
  );
}
