import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { apiFetch } from "./api";
import { publishUnread, useUnreadCounts, type UnreadCounts } from "./unread-store";

// Réglages du compte appliqués aux notifications reçues appli ouverte (téléphone déverrouillé) : bandeau et son.
// Les notifications reçues appli fermée ou téléphone verrouillé sont affichées par le système ; le serveur
// applique déjà les catégories, le son et le masquage du texte (voir NotificationService).
let foreground = { banner: true, sound: true };

export function applyForegroundPreferences(preferences: { inAppBanner: boolean; sound: boolean }): void {
  foreground = { banner: preferences.inAppBanner, sound: preferences.sound };
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: foreground.banner,
    shouldShowList: true,
    shouldPlaySound: foreground.sound,
    shouldSetBadge: true,
  }),
});

// Réglages relus à chaque connexion : le bandeau appli ouverte en dépend.
async function loadPreferences(sessionToken: string): Promise<void> {
  const response = await apiFetch("/api/notification-preferences", { sessionToken }).catch(() => null);
  const body = response?.ok ? await response.json().catch(() => null) : null;
  if (body?.preferences) applyForegroundPreferences(body.preferences);
}

let registeredToken: string | null = null;

// Jeton push du téléphone, enregistré sur le compte connecté. Rien sur simulateur, sans
// autorisation, ou tant que le projet EAS n'est pas configuré (`eas init`).
async function registerForPush(sessionToken: string): Promise<void> {
  try {
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!Device.isDevice || !projectId) return;
    if (Platform.OS === "android") {
      // Importance haute : bandeau déverrouillé ; visibilité publique : la notification s'affiche aussi sur l'écran verrouillé.
      await Notifications.setNotificationChannelAsync("default", {
        name: "EvolyFoot",
        importance: Notifications.AndroidImportance.HIGH,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
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

export type { UnreadCounts } from "./unread-store";

export async function readUnread(sessionToken: string): Promise<UnreadCounts | null> {
  const response = await apiFetch("/api/notifications", { sessionToken }).catch(() => null);
  const body = response?.ok ? await response.json().catch(() => null) : null;
  if (!body) return null;
  Notifications.setBadgeCountAsync(body.unreadCount).catch(() => undefined);
  const counts = { unreadCount: body.unreadCount, unreadMessages: body.unreadMessages, pendingTutorPlayerIds: body.pendingTutorPlayerIds ?? [] };
  publishUnread(counts);
  return counts;
}

// Compteurs « non lus » partagés, relus à l’affichage et toutes les 30 secondes.
export function useUnread(sessionToken: string | null): UnreadCounts {
  return useUnreadCounts(sessionToken, readUnread);
}

// Branché une fois sous la session : enregistre le téléphone, met à jour la pastille de l'icône au
// retour dans l'appli et ouvre l'écran visé quand on touche une notification.
export function usePushNotifications(sessionToken: string | null, routeForLink: (link: string) => string): void {
  useEffect(() => {
    if (!sessionToken) return;
    void registerForPush(sessionToken);
    void loadPreferences(sessionToken);
    void readUnread(sessionToken);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void readUnread(sessionToken);
    });
    // Notification reçue appli ouverte (nouveau message…) : pastilles à jour tout de suite.
    const received = Notifications.addNotificationReceivedListener(() => void readUnread(sessionToken));
    return () => {
      appState.remove();
      received.remove();
    };
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
