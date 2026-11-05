import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { apiFetch } from "./api";

// Version web (captures des fiches store, voir scripts/store-screenshots/build.mjs) : pas de push
// ni de pastille d'icône dans un navigateur, seulement les compteurs « non lus ».

export async function unregisterPush(): Promise<void> {}

export interface UnreadCounts {
  unreadCount: number;
  unreadMessages: number;
}

export async function readUnread(sessionToken: string): Promise<UnreadCounts | null> {
  const response = await apiFetch("/api/notifications", { sessionToken }).catch(() => null);
  const body = response?.ok ? await response.json().catch(() => null) : null;
  return body ? { unreadCount: body.unreadCount, unreadMessages: body.unreadMessages } : null;
}

export function useUnread(sessionToken: string | null): UnreadCounts {
  const [counts, setCounts] = useState<UnreadCounts>({ unreadCount: 0, unreadMessages: 0 });
  useFocusEffect(
    useCallback(() => {
      if (sessionToken) void readUnread(sessionToken).then((value) => value && setCounts(value));
    }, [sessionToken]),
  );
  return counts;
}

export function usePushNotifications(): void {}
