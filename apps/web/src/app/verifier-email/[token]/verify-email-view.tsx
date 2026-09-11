"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function VerifyEmailView({ token }: { token: string }) {
  const [status, setStatus] = useState<"checking" | "ok" | "invalid">("checking");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const body = await response.json().catch(() => ({}));
        if (cancelled) {
          return;
        }
        if (response.ok) {
          setDisplayName(typeof body.displayName === "string" ? body.displayName : "");
          setStatus("ok");
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

  return (
    <main className="onboarding-shell">
      <section className="onboarding-intro">
        <Link className="onboarding-brand" href="/">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <div>
          <span className="eyebrow light">Confirmation d’e-mail</span>
          {status === "checking" && <h1>Vérification…</h1>}
          {status === "ok" && (
            <>
              <h1>{displayName ? `Merci ${displayName}, c’est confirmé.` : "C’est confirmé."}</h1>
              <p>Ton adresse e-mail est validée. Tu peux continuer à utiliser ton compte normalement.</p>
            </>
          )}
          {status === "invalid" && (
            <>
              <h1>Ce lien n’est plus valide.</h1>
              <p>
                Il a peut-être expiré (48 heures) ou déjà été utilisé. Connecte-toi puis demande un nouveau lien
                depuis ton profil.
              </p>
            </>
          )}
        </div>
      </section>

      {status !== "checking" && (
        <section className="onboarding-panel">
          <Link className="continue-button" href="/connexion">
            Aller à la connexion <span aria-hidden="true">→</span>
          </Link>
        </section>
      )}
    </main>
  );
}
