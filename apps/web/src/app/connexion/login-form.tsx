"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
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
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Une erreur est survenue.");
        setSubmitting(false);
        return;
      }
      // Redirige directement vers le tableau de bord plutôt que de laisser l'éducateur cliquer
      // sur un lien manuel -- une fois connecté, il n'y a plus de raison de le retenir sur cette
      // page. `success` reste affiché un court instant pendant la navigation (état de secours si
      // jamais celle-ci tardait), et `router.replace` (pas `push`) pour qu'un retour arrière ne
      // ramène pas sur le formulaire de connexion déjà validé.
      setSuccess(true);
      router.replace("/");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="team-form" onSubmit={submit} noValidate>
      <header>
        <span className="eyebrow">CONNEXION</span>
        <h2>Content de te revoir.</h2>
        <p>Connecte-toi avec l’adresse e-mail de ton compte éducateur.</p>
      </header>
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
          autoComplete="current-password"
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
      {success && (
        <div className="success-message" role="status">
          <strong>Connexion réussie !</strong>
          <span>Ton compte est prêt.</span>
          <Link href="/">Aller au tableau de bord →</Link>
        </div>
      )}
      <button className="continue-button" disabled={submitting} type="submit">
        {submitting ? "Connexion…" : "Se connecter"} <span>→</span>
      </button>
      <Link className="back-link" href="/inscription">
        Pas encore de compte ? Créer un compte
      </Link>
    </form>
  );
}
