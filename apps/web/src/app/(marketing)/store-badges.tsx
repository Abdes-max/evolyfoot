// Liens des applications mobiles. Tant qu'elles ne sont pas publiées, l'App Store pointe vers une
// recherche « EvolyFoot » et Google Play vers la fiche attendue de l'identifiant de l'app (voir
// app.json) : à remplacer par les liens définitifs (identifiant numérique App Store) à la publication.
export const storeLinks = {
  coach: {
    appStore: "https://apps.apple.com/fr/search?term=EvolyFoot%20Coach",
    googlePlay: "https://play.google.com/store/apps/details?id=com.evolyfoot.coach",
  },
  player: {
    appStore: "https://apps.apple.com/fr/search?term=EvolyFoot%20Player",
    googlePlay: "https://play.google.com/store/apps/details?id=com.evolyfoot.player",
  },
} as const;

export type StoreApp = keyof typeof storeLinks;

const appNames: Record<StoreApp, string> = { coach: "EvolyFoot Coach", player: "EvolyFoot Player" };

function AppleLogo() {
  return (
    <svg aria-hidden="true" height="26" viewBox="0 0 24 24" width="26">
      <path
        d="M16.37 1.43c0 1.14-.5 2.27-1.18 3.08-.74.9-1.99 1.57-2.99 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.57-2.27 1.21-2.98.8-.94 2.14-1.64 3.25-1.68.03.13.05.28.05.43Zm4.56 15.71c-.03.07-.46 1.58-1.52 3.12-.94 1.34-1.94 2.71-3.43 2.71-1.52 0-1.9-.88-3.63-.88-1.7 0-2.3.91-3.67.91-1.38 0-2.33-1.26-3.43-2.8-1.29-1.82-2.32-4.63-2.32-7.28 0-4.28 2.8-6.55 5.55-6.55 1.45 0 2.68.95 3.6.95.87 0 2.22-1.01 3.9-1.01.61 0 2.89.06 4.37 2.19-.13.09-2.38 1.37-2.38 4.19 0 3.26 2.85 4.42 2.96 4.45Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlayLogo() {
  return (
    <svg aria-hidden="true" height="26" viewBox="0 0 24 26" width="24">
      <path d="M1.2.6 13.7 13 1.2 25.4c-.4-.2-.7-.7-.7-1.3V1.9c0-.6.3-1.1.7-1.3Z" fill="#00d7fe" />
      <path d="M17.9 8.8 13.7 13 1.2.6c.2-.1.5-.1.8 0l15.9 8.2Z" fill="#00f076" />
      <path d="M17.9 17.2 2 25.4c-.3.1-.6.1-.8 0L13.7 13l4.2 4.2Z" fill="#ff3a44" />
      <path d="m17.9 8.8 4.4 2.3c1.3.7 1.3 2.1 0 2.8l-4.4 2.3-4.2-4.2 4.2-3.2Z" fill="#ffd400" />
    </svg>
  );
}

// Badges noirs « Télécharger dans l'App Store » et « Disponible sur Google Play », dessinés ici
// (pas d'image externe) pour l'app choisie.
export function StoreBadges({ app }: { app: StoreApp }) {
  const links = storeLinks[app];
  return (
    <div className="m-store-badges">
      <a aria-label={`Télécharger ${appNames[app]} dans l’App Store`} className="m-store-badge" href={links.appStore} rel="noopener" target="_blank">
        <AppleLogo />
        <span>
          <small>Télécharger dans</small>
          <strong>l’App Store</strong>
        </span>
      </a>
      <a aria-label={`${appNames[app]} sur Google Play`} className="m-store-badge" href={links.googlePlay} rel="noopener" target="_blank">
        <PlayLogo />
        <span>
          <small>DISPONIBLE SUR</small>
          <strong>Google Play</strong>
        </span>
      </a>
    </div>
  );
}
