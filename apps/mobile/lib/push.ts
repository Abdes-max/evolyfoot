import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { apiFetch } from "./api";

// Une notification reçue appli ouverte s'affiche quand même en bandeau.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

let registeredToken: string | null = null;

// Jeton push du téléphone, enregistré sur le compte connecté. Rien sur simulateur, sans
// autorisation, ou tant que le projet EAS n'est pas configuré (`eas init`).
async function registerForPush(sessionToken: string): Promise<void> {
  try {
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!Device.isDevice || !projectId) return;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", { name: "EvolyFoot", importance: Notifications.AndroidImportance.HIGH });
    }
    const current = await Notifications.getPermissionsAsync();
    const status = current.granted ? "granted" : (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await apiFetch("/api/push-devices", { method: "POST", sessionToken, body: JSON.stringify({ token, platform: Platform.OS }) });
    registeredToken = token;
  } catch {
    // Le push reste facultatif : l'appli fonctionne sans.
  }
}

// À appeler avant la déconnexion : ce téléphone ne doit plus recevoir les alertes de ce compte.
export async function unregisterPush(sessionToken: string): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  Notifications.setBadgeCountAsync(0).catch(() => undefined);
  if (token) await apiFetch("/api/push-devices", { method: "DELETE", sessionToken, body: JSON.stringify({ token }) }).catch(() => undefined);
}

export interface UnreadCounts {
  unreadCount: number;
  unreadMessages: number;
}

export async function readUnread(sessionToken: string): Promise<UnreadCounts | null> {
  const response = await apiFetch("/api/notifications", { sessionToken }).catch(() => null);
  const body = response?.ok ? await response.json().catch(() => null) : null;
  if (!body) return null;
  Notifications.setBadgeCountAsync(body.unreadCount).catch(() => undefined);
  return { unreadCount: body.unreadCount, unreadMessages: body.unreadMessages };
}

// Compteurs « non lus » relus à chaque affichage de l'écran.
export function useUnread(sessionToken: string | null): UnreadCounts {
  const [counts, setCounts] = useState<UnreadCounts>({ unreadCount: 0, unreadMessages: 0 });
  useFocusEffect(
    useCallback(() => {
      if (sessionToken) void readUnread(sessionToken).then((value) => value && setCounts(value));
    }, [sessionToken]),
  );
  return counts;
}

// Branché une fois sous la session : enregistre le téléphone, met à jour la pastille de l'icône au
// retour dans l'appli et ouvre l'écran visé quand on touche une notification.
export function usePushNotifications(sessionToken: string | null, routeForLink: (link: string) => string): void {
  useEffect(() => {
    if (!sessionToken) return;
    void registerForPush(sessionToken);
    void readUnread(sessionToken);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void readUnread(sessionToken);
    });
    return () => appState.remove();
  }, [sessionToken]);

  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const link = lastResponse?.notification.request.content.data?.link;
    if (sessionToken && typeof link === "string") {
      router.push(routeForLink(link) as never);
      // Une alerte ouverte ne doit pas rouvrir son écran à la prochaine connexion.
      Notifications.clearLastNotificationResponseAsync?.().catch(() => undefined);
    }
  }, [lastResponse, sessionToken, routeForLink]);
}
