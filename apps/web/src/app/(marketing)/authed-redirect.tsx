"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Un éducateur déjà connecté qui arrive sur la page d'accueil vitrine est renvoyé vers son
// tableau de bord (/app). Le contenu vitrine reste rendu côté serveur pour le SEO ; ce composant
// ne fait que la redirection, après coup, pour un visiteur authentifié.
export function AuthedRedirect({ to }: { to: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/session");
        const body = await response.json().catch(() => ({ educator: null }));
        if (!cancelled && body.educator) {
          router.replace(to);
        }
      } catch {
        // Visiteur non connecté (ou erreur réseau) : on le laisse sur la vitrine.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, to]);

  return null;
}
