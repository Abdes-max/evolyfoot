// Alias réseau standard de l'émulateur Android vers le localhost de la machine hôte,
// utilisé par défaut en développement local (voir .env.example pour la configuration réelle).
const DEFAULT_API_URL = "http://10.0.2.2:3000";

export function apiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

export interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  sessionToken?: string | null;
  headers?: Record<string, string>;
}

// L'application mobile n'a pas de pot de cookies : elle porte le jeton de session dans
// l'en-tête Authorization, et signale sa plateforme pour que le serveur le lui renvoie
// dans le corps de la réponse à l'inscription/la connexion (voir apps/web/src/server/auth.ts).
export function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { sessionToken, headers, ...rest } = options;

  return fetch(`${apiBaseUrl()}${path}`, {
    ...rest,
    headers: {
      "content-type": "application/json",
      "x-client-platform": "mobile",
      ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
      ...headers,
    },
  });
}
