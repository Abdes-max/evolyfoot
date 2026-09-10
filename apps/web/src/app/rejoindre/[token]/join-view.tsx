"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

interface InvitePreview {
  playerName: string;
  teamName: string | null;
  coachName: string;
}

export function JoinView({ token }: { token: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "invalid">("loading");
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/invites/${encodeURIComponent(token)}`);
        const body = await response.json().catch(() => ({ invite: null }));
        if (cancelled) {
          return;
        }
        if (response.ok && body.invite) {
          setInvite(body.invite);
          setStatus("ready");
        } else {
          setStatus("invalid");
        }
      } catch {
        if (!cancelled) {
          setStatus("invalid");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/register-player", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, email, password, displayName }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Une erreur est survenue.");
        return;
      }
      window.location.href = "/joueur";
    } catch {
      setError("Une erreur est survenue, réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="onboarding-shell">
      <section className="onboarding-intro">
        <Link className="onboarding-brand" href="/">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <div>
          <span className="eyebrow light">Espace joueur / tuteur</span>
          {status === "ready" && invite ? (
            <>
              <h1>Suis la progression de {invite.playerName}.</h1>
              <p>
                {invite.coachName} t’invite à suivre {invite.playerName}
                {invite.teamName ? ` (${invite.teamName})` : ""} : évaluations, présences, calendrier et convocations.
              </p>
            </>
          ) : status === "invalid" ? (
            <>
              <h1>Cette invitation n’est plus valide.</h1>
              <p>Le lien a peut-être expiré ou a déjà été utilisé. Demande un nouveau lien à l’éducateur.</p>
            </>
          ) : (
            <h1>Chargement…</h1>
          )}
        </div>
      </section>

      {status === "ready" && (
        <section className="onboarding-panel">
          <form className="team-form" onSubmit={submit} noValidate>
            <header>
              <span className="eyebrow">CRÉER MON ACCÈS</span>
              <h2>Un compte pour suivre {invite?.playerName}.</h2>
            </header>
            <label>
              Ton nom
              <input
                autoComplete="name"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Ex. Parent de Kylian"
                required
                type="text"
                value={displayName}
              />
            </label>
            <label>
              Adresse e-mail
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              Mot de passe (10 caractères minimum)
              <input
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button className="continue-button" disabled={submitting} type="submit">
              {submitting ? "Création…" : "Créer mon accès"} <span aria-hidden="true">→</span>
            </button>
            <Link className="back-link" href="/connexion">
              J’ai déjà un compte
            </Link>
          </form>
        </section>
      )}
    </main>
  );
}
