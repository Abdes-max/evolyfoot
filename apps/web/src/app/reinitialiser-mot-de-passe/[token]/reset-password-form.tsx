"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

const minPasswordLength = 10;

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"form" | "done" | "expired">("form");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < minPasswordLength) {
      setError(`Le mot de passe doit contenir au moins ${minPasswordLength} caractères.`);
      return;
    }
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (response.status === 410) {
        setStatus("expired");
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Une erreur est survenue.");
        return;
      }
      setStatus("done");
    } catch {
      setError("Une erreur est survenue, réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "done") {
    return (
      <div className="team-form">
        <div className="success-message" role="status">
          <strong>Mot de passe modifié.</strong>
          <span>Tu peux te connecter avec ton nouveau mot de passe.</span>
          <Link href="/connexion">Se connecter →</Link>
        </div>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="team-form">
        <p className="field-error" role="alert">
          Ce lien n’est plus valide : il a expiré, a déjà servi ou a été remplacé par un plus récent.
        </p>
        <Link className="back-link" href="/mot-de-passe-oublie">
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <form className="team-form" onSubmit={submit} noValidate>
      <header>
        <span className="eyebrow">RÉINITIALISATION</span>
        <h2>Nouveau mot de passe</h2>
        <p>Au moins {minPasswordLength} caractères.</p>
      </header>
      <label>
        Nouveau mot de passe
        <input autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
      </label>
      <label>
        Confirme le mot de passe
        <input autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button className="continue-button" disabled={submitting} type="submit">
        {submitting ? "Enregistrement…" : "Enregistrer"} <span>→</span>
      </button>
    </form>
  );
}
