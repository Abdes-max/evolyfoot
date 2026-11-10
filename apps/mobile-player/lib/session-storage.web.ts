const SESSION_TOKEN_KEY = "evolyfoot.session-token";

// Version web, réservée aux captures des fiches store (scripts/store-screenshots/build.mjs) : le
// navigateur n'a pas de trousseau, le jeton d'un compte de démo local va dans le localStorage.
// Le projet ne charge pas les types du DOM : seul ce qui sert ici est décrit.
interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function storage(): WebStorage | undefined {
  return (globalThis as { localStorage?: WebStorage }).localStorage;
}

export async function readSessionToken(): Promise<string | null> {
  try {
    return storage()?.getItem(SESSION_TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export async function writeSessionToken(token: string): Promise<void> {
  try {
    storage()?.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    // La session reste alors en mémoire, comme sur le téléphone.
  }
}

export async function clearSessionToken(): Promise<void> {
  try {
    storage()?.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // Rien à effacer.
  }
}
