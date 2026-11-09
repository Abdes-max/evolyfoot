// Proposition d'installer l'app mobile depuis le web mobile. Pour l'instant iOS seulement : l'app Android
// n'est pas encore publiée (voir storeLinks).
export type InstallTarget = "coach" | "player";

export const installBannerStorageKey = "evolyfoot-install-banner-dismissed";
// Une fois masquée, la bannière ne revient qu'après ce délai.
export const installBannerSnoozeMs = 14 * 24 * 3600_000;

// iPhone et iPod (l'iPad garde l'interface large, le web lui convient).
export function isIosPhone(userAgent: string): boolean {
  return /iPhone|iPod/.test(userAgent);
}

// Les pages du joueur et des parents proposent EvolyFoot Player ; le reste (éducateur) EvolyFoot Coach.
export function installTargetForPath(pathname: string): InstallTarget {
  return pathname === "/joueur" || pathname.startsWith("/joueur/") ? "player" : "coach";
}

// Pages où la bannière gêne ou fait doublon : la page Télécharger elle-même, l'administration et la saisie
// de mot de passe.
function isExcludedPath(pathname: string): boolean {
  return /^\/(telecharger|admin|mot-de-passe-oublie|connexion\/reinitialiser)(\/|$)/.test(pathname);
}

export function isSnoozed(dismissedAt: string | null, now: number): boolean {
  const time = dismissedAt === null ? Number.NaN : Number(dismissedAt);
  return Number.isFinite(time) && now - time < installBannerSnoozeMs;
}

// À afficher sur un iPhone, dans Safari (ou un autre navigateur), pas dans une app installée sur l'écran d'accueil.
export function shouldOfferInstall(input: { userAgent: string; standalone: boolean; pathname: string; dismissedAt: string | null; now: number }): boolean {
  return isIosPhone(input.userAgent) && !input.standalone && !isExcludedPath(input.pathname) && !isSnoozed(input.dismissedAt, input.now);
}
