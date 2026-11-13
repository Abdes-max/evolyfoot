import { apiFetch } from "./api";
import { publishUnread, useUnreadCounts, type UnreadCounts } from "./unread-store";

// Version web (captures des fiches store, voir scripts/store-screenshots/build.mjs) : pas de push
// ni de pastille d'icône dans un navigateur, seulement les compteurs « non lus ».

export async function unregisterPush(): Promise<void> {}

export function applyForegroundPreferences(): void {}

export type { UnreadCounts } from "./unread-store";

export async function readUnread(sessionToken: string): Promise<UnreadCounts | null> {
  const response = await apiFetch("/api/notifications", { sessionToken }).catch(() => null);
  const body = response?.ok ? await response.json().catch(() => null) : null;
  if (!body) return null;
  const counts = { unreadCount: body.unreadCount, unreadMessages: body.unreadMessages, pendingTutorPlayerIds: body.pendingTutorPlayerIds ?? [] };
  publishUnread(counts);
  return counts;
}

// Compteurs « non lus » partagés, relus à l’affichage et toutes les 30 secondes.
export function useUnread(sessionToken: string | null): UnreadCounts {
  return useUnreadCounts(sessionToken, readUnread);
}

export function usePushNotifications(): void {}
