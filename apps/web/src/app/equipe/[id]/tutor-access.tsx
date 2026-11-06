"use client";

import { useEffect, useState } from "react";

interface Tutor {
  accountId: string;
  displayName: string;
  email: string;
  since: string;
}

interface TutorRequest {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

async function readError(response: Response | null, fallback: string): Promise<string> {
  const body = response ? await response.json().catch(() => ({})) : {};
  return typeof body.error === "string" ? body.error : fallback;
}

// Bloc « Accès tuteur / joueur » de la fiche joueur : le lien d'invitation (toujours le même, à
// renvoyer autant que nécessaire), les demandes reçues par ce lien à accepter ou refuser, et les
// comptes déjà associés, que l'éducateur peut retirer.
export function TutorAccess({ playerId, playerName }: { playerId: string; playerName: string }) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [requests, setRequests] = useState<TutorRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [inviteResponse, tutorsResponse] = await Promise.all([
        fetch(`/api/invites?playerId=${encodeURIComponent(playerId)}`).catch(() => null),
        fetch(`/api/roster/${encodeURIComponent(playerId)}/tuteurs`).catch(() => null),
      ]);
      const invite = inviteResponse?.ok ? await inviteResponse.json().catch(() => null) : null;
      const list = tutorsResponse?.ok ? await tutorsResponse.json().catch(() => null) : null;
      if (cancelled) return;
      setInviteUrl(invite?.url ?? null);
      setTutors(list?.tutors ?? []);
      setRequests(list?.requests ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  async function generate(renew: boolean) {
    setBusy(true);
    setError("");
    setCopied(false);
    const response = await fetch("/api/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId, renew }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError(await readError(response, "La génération du lien a échoué, réessaie."));
      return;
    }
    setInviteUrl((await response.json()).url);
  }

  async function copy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      // Le champ reste sélectionnable à la main.
    }
  }

  async function update(method: "POST" | "DELETE", body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/roster/${encodeURIComponent(playerId)}/tuteurs`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError(await readError(response, "La modification n’a pas été enregistrée, réessaie."));
      return;
    }
    const list = await response.json();
    setTutors(list.tutors ?? []);
    setRequests(list.requests ?? []);
  }

  return (
    <div className="player-block print-hidden">
      <div className="player-block-head">
        <h2>Accès tuteur / joueur</h2>
      </div>
      <p className="player-invite-lead">
        Envoie ce lien au tuteur (ou aux deux parents) : chacun crée son compte, puis tu acceptes sa demande. Il ne voit alors que le suivi de {playerName}
        (évaluations, présences, calendrier, convocations).
      </p>
      {inviteUrl ? (
        <>
          <div className="player-invite-result">
            <input aria-label="Lien d’invitation" readOnly value={inviteUrl} />
            <button className="player-ghost" onClick={copy} type="button">
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
          <button className="text-button tutor-renew" disabled={busy} onClick={() => generate(true)} type="button">
            Remplacer par un nouveau lien (l’ancien ne marchera plus)
          </button>
        </>
      ) : (
        <button className="player-primary" disabled={busy} onClick={() => generate(false)} type="button">
          {busy ? "…" : "Générer un lien d’invitation"}
        </button>
      )}

      {requests.length > 0 && (
        <section aria-labelledby="tutor-requests-title" className="tutor-list">
          <h3 id="tutor-requests-title">Demandes en attente</h3>
          <ul>
            {requests.map((request) => (
              <li key={request.id}>
                <div>
                  <strong>{request.displayName}</strong>
                  <span>
                    {request.email} · le {dayLabel(request.createdAt)}
                  </span>
                </div>
                <div className="tutor-actions">
                  <button className="player-primary" disabled={busy} onClick={() => update("POST", { requestId: request.id, accept: true })} type="button">
                    Accepter
                  </button>
                  <button className="player-ghost" disabled={busy} onClick={() => update("POST", { requestId: request.id, accept: false })} type="button">
                    Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="tutor-linked-title" className="tutor-list">
        <h3 id="tutor-linked-title">Tuteurs associés</h3>
        {tutors.length === 0 ? (
          <p className="player-invite-lead">Aucun compte n’a encore accès au suivi de {playerName}.</p>
        ) : (
          <ul>
            {tutors.map((tutor) => (
              <li key={tutor.accountId}>
                <div>
                  <strong>{tutor.displayName}</strong>
                  <span>
                    {tutor.email} · depuis le {dayLabel(tutor.since)}
                  </span>
                </div>
                <div className="tutor-actions">
                  <button className="player-ghost" disabled={busy} onClick={() => update("DELETE", { accountId: tutor.accountId })} type="button">
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p className="player-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
