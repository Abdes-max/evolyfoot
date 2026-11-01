"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Une erreur est survenue.");
        return;
      }
      setSent(true);
    } catch {
      setError("Une erreur est survenue, réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="team-form" onSubmit={submit} noValidate>
      <header>
        <span className="eyebrow">RÉINITIALISATION</span>
        <h2>Mot de passe oublié ?</h2>
        <p>Indique l’adresse e-mail de ton compte, éducateur ou tuteur.</p>
      </header>
      <label>
        Adresse e-mail
        <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {sent && (
        <div className="success-message" role="status">
          <strong>C’est noté.</strong>
          <span>Si un compte existe pour cette adresse, un lien valable 1 heure vient de partir. Pense à regarder tes indésirables.</span>
        </div>
      )}
      <button className="continue-button" disabled={submitting} type="submit">
        {submitting ? "Envoi…" : "Recevoir le lien"} <span>→</span>
      </button>
      <Link className="back-link" href="/connexion">
        Retour à la connexion
      </Link>
    </form>
  );
}
