"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export function RegisterForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Une erreur est survenue.");
        return;
      }
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="team-form" onSubmit={submit} noValidate>
      <header>
        <span className="eyebrow">CRÉER UN COMPTE</span>
        <h2>Bienvenue sur EvolyFoot.</h2>
        <p>Un compte éducateur pour suivre la progression de ton équipe.</p>
      </header>
      <label>
        Nom
        <input
          autoComplete="name"
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Ex. Abdes Meziane"
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
        Mot de passe
        <input
          autoComplete="new-password"
          minLength={10}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <small className="field-hint">Au moins 10 caractères.</small>
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <div className="success-message" role="status">
          <strong>Compte créé !</strong>
          <span>Tu peux maintenant configurer ton équipe.</span>
          <Link href="/onboarding">Configurer mon équipe →</Link>
        </div>
      )}
      <button className="continue-button" disabled={submitting} type="submit">
        {submitting ? "Création…" : "Créer mon compte"} <span>→</span>
      </button>
      <Link className="back-link" href="/connexion">
        Déjà un compte ? Se connecter
      </Link>
    </form>
  );
}
