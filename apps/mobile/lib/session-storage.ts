import * as SecureStore from "expo-secure-store";

const SESSION_TOKEN_KEY = "evolyfoot.session-token";

// Trousseau du téléphone : le jeton de session donne accès au compte, il ne va pas dans un stockage
// en clair. Une panne de stockage ne bloque pas la connexion : la session reste alors en mémoire.
export async function readSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY).catch(() => null);
}

export async function writeSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token).catch(() => undefined);
}

export async function clearSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY).catch(() => undefined);
}
