"use client";

import { useState, type FormEvent } from "react";

export default function SuperAdminLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/super-admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      if (response.ok) {
        window.location.assign("/super-admin");
        return;
      }
      const body = await response.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Connexion impossible.");
    } catch {
      setError("Connexion impossible.");
    }
    setBusy(false);
  }

  return (
    <main className="sa-login">
      <form className="sa-card" onSubmit={submit}>
        <h1>Superadmin</h1>
        <label>
          Adresse e-mail
          <input autoComplete="username" name="email" required type="email" />
        </label>
        <label>
          Mot de passe
          <input autoComplete="current-password" name="password" required type="password" />
        </label>
        {error ? <p className="sa-error">{error}</p> : null}
        <button disabled={busy} type="submit">
          Se connecter
        </button>
      </form>
    </main>
  );
}
