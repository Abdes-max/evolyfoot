// Pages publiques du site vitrine : accessibles sans session (contrairement au reste de
// l'application, protégé par proxy.ts + auth-gate.tsx). Le tableau de bord de l'app vit
// désormais sur /app ; `/` est la page d'accueil vitrine.
export const MARKETING_PATHS = [
  "/",
  "/educateurs",
  "/methode",
  "/tarifs",
  "/a-propos",
  "/contact",
  "/telecharger",
  "/mentions-legales",
  "/confidentialite",
  "/cgu",
] as const;

// Chemins publics à préfixe (pas une page vitrine listée ci-dessus, mais accessible sans
// session) : la page d'acceptation d'invitation tuteur `/rejoindre/:token`, la confirmation
// d'e-mail à l'inscription `/verifier-email/:token`, et l'image de partage générée par Next pour
// la vitrine (`/opengraph-image`, suffixée d'un hash en prod).
const PUBLIC_PREFIXES = ["/rejoindre/", "/verifier-email/", "/opengraph-image"];

// `true` si le chemin est public : une page vitrine (correspondance exacte -- `/` ne doit surtout
// pas se comporter comme un préfixe) ou un chemin sous un préfixe public.
export function isMarketingPath(pathname: string): boolean {
  return (
    (MARKETING_PATHS as readonly string[]).includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
