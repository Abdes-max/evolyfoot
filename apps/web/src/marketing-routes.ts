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

// `true` si le chemin est une page vitrine (correspondance exacte -- ces pages n'ont pas de
// sous-chemins ; `/` ne doit surtout pas se comporter comme un préfixe).
export function isMarketingPath(pathname: string): boolean {
  return (MARKETING_PATHS as readonly string[]).includes(pathname);
}
