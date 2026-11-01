"use client";

import { useState, type FormEvent } from "react";

// Bloc « Mes données », partagé par le profil de l'éducateur et l'espace joueur.
export function AccountPrivacy({ warning }: { warning: string }) {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        window.location.assign("/");
        return;
      }
      const body = await response.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "La suppression a échoué.");
    } catch {
      setError("La suppression a échoué, réessaie.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section aria-labelledby="account-privacy-title" className="account-privacy">
      <h3 id="account-privacy-title">Mes données</h3>
      <div className="account-privacy-actions">
        <a className="profil-ghost" download href="/api/account/export">
          Télécharger mes données
        </a>
        {!confirming && (
          <button className="account-privacy-delete" onClick={() => setConfirming(true)} type="button">
            Supprimer mon compte
          </button>
        )}
      </div>
      {confirming && (
        <form onSubmit={deleteAccount}>
          <p role="alert">{warning}</p>
          <label>
            <span>Confirme avec ton mot de passe</span>
            <input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
          {error && <p className="profil-error">{error}</p>}
          <div className="account-privacy-actions">
            <button className="account-privacy-delete" disabled={deleting} type="submit">
              {deleting ? "Suppression…" : "Supprimer définitivement"}
            </button>
            <button className="profil-ghost" onClick={() => setConfirming(false)} type="button">
              Annuler
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
