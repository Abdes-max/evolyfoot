// `request.url` reflète le Host reçu par le serveur Node sous-jacent -- fiable derrière le
// reverse proxy de prod (Caddy forwarde le vrai nom de domaine), mais pas en dev local : `next
// dev` écoute sur toutes les interfaces, et un navigateur/outil qui s'y connecte via l'adresse
// d'écoute plutôt que "localhost" fait remonter un Host "0.0.0.0:3000" -- une adresse d'écoute,
// jamais joignable en retour par un autre appareil (constaté : un lien d'invitation généré en
// local pointait vers "https://0.0.0.0:3000/rejoindre/…", ni cliquable ni vrai en HTTPS). Cette
// fonction corrige les deux pour un hôte reconnu comme local : "0.0.0.0" remplacé par
// "localhost", et protocole forcé à http (le serveur de dev ne sert jamais de TLS, quoi que le
// Host laisse croire) -- un vrai nom de domaine (prod) garde son protocole tel quel.
//
// Partagé par tout ce qui construit un lien absolu à partir d'une requête entrante : invitation
// tuteur (player-invite.ts) et confirmation d'e-mail (email-verification.ts).
export function resolveOrigin(request: Request): string {
  const url = new URL(request.url);
  const isLocal = url.hostname === "0.0.0.0" || url.hostname === "127.0.0.1" || url.hostname === "localhost";
  const hostname = url.hostname === "0.0.0.0" ? "localhost" : url.hostname;
  const protocol = isLocal ? "http:" : url.protocol;
  return `${protocol}//${hostname}${url.port ? `:${url.port}` : ""}`;
}
