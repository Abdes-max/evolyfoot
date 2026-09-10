"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { isMarketingPath } from "@/marketing-routes";

// Le proxy (apps/web/src/proxy.ts) ne vérifie que la présence du cookie de session, pas sa
// validité en base -- une vérification bon marché à chaque navigation, avant même que le JS
// client ne s'exécute. Ce composant referme la vraie faille que ça laisse ouverte : un cookie
// périmé (session expirée, ou simplement une base de données réinitialisée en local) passe le
// proxy mais ne correspond à aucun éducateur réel. Sans ce garde-fou, chaque page retombait sur
// son propre contenu de démonstration pour ce cas précis -- exactement l'écran accessible sans
// être connecté que cette page doit éliminer. Même rôle que AuthGate dans
// apps/mobile/app/_layout.tsx, côté web.
const AUTH_PATHS = ["/connexion", "/inscription"];

// Un compte "player" (tuteur/joueur) ne peut voir QUE l'espace /joueur ; un compte "coach" ne
// peut PAS y aller. AuthGate redirige selon le rôle renvoyé par /api/auth/session.
function isPlayerArea(pathname: string): boolean {
  return pathname === "/joueur" || pathname.startsWith("/joueur/");
}

type SessionCheck = {
  // Le pathname pour lequel `status` a été établi. Tant qu'il ne correspond pas au pathname
  // courant, la vérification pour cette page n'est pas encore terminée -- dérivé au rendu (voir
  // `status` plus bas), jamais posé par un setState synchrone dans l'effet : react-hooks/set-
  // state-in-effect interdit ça (rendu en cascade), et surtout ça réglait mal le bug initial
  // (statut resté périmé après un router.replace vers une autre page protégée).
  pathname: string;
  status: "authenticated" | "redirecting";
};

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPath =
    isMarketingPath(pathname) || AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const [sessionCheck, setSessionCheck] = useState<SessionCheck | null>(null);

  useEffect(() => {
    if (isPublicPath) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/auth/session");
        const body = await response.json().catch(() => ({ educator: null, role: null }));
        if (cancelled) {
          return;
        }
        const role: "coach" | "player" | null = body.role ?? (body.educator ? "coach" : null);
        const playerArea = isPlayerArea(pathname);
        if (!role) {
          setSessionCheck({ pathname, status: "redirecting" });
          router.replace("/connexion");
        } else if (role === "player" && !playerArea) {
          setSessionCheck({ pathname, status: "redirecting" });
          router.replace("/joueur");
        } else if (role === "coach" && playerArea) {
          setSessionCheck({ pathname, status: "redirecting" });
          router.replace("/app");
        } else {
          setSessionCheck({ pathname, status: "authenticated" });
        }
      } catch {
        if (!cancelled) {
          setSessionCheck({ pathname, status: "redirecting" });
          router.replace("/connexion");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPublicPath, pathname, router]);

  const status = isPublicPath ? "authenticated" : sessionCheck?.pathname === pathname ? sessionCheck.status : "checking";

  if (status !== "authenticated") {
    // Rien de significatif à l'écran tant que la session n'est pas confirmée réelle -- ni
    // contenu de démonstration, ni indice sur ce que contiendrait la page.
    return null;
  }

  return <>{children}</>;
}
