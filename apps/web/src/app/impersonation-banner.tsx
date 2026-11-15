"use client";

import { useState } from "react";

// Bandeau fixe affiché pendant une connexion « en tant que » un éducateur (ouverte par un superadmin).
export function ImpersonationBanner({ superAdminEmail }: { superAdminEmail: string }) {
  const [busy, setBusy] = useState(false);

  async function leave() {
    setBusy(true);
    try {
      const response = await fetch("/api/impersonation/stop", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      window.location.assign(typeof body.redirect === "string" ? body.redirect : "/super-admin");
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="impersonation-banner" role="status">
      <span>Connecté en tant que cet éducateur par {superAdminEmail} — session limitée à 30 minutes, actions sensibles bloquées.</span>
      <button disabled={busy} onClick={leave} type="button">
        Quitter
      </button>
    </div>
  );
}
