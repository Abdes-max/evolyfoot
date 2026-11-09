import { describe, expect, it } from "vitest";
import { defaultNotificationPreferences, hiddenNotificationText, isPushEnabled, parseNotificationPreferences, pushText } from "./notification-preferences";

describe("réglages de notification", () => {
  it("tout est activé par défaut", () => {
    expect(parseNotificationPreferences(undefined)).toEqual(defaultNotificationPreferences);
    expect(Object.values(defaultNotificationPreferences).every(Boolean)).toBe(true);
  });

  it("garde les booléens reçus et reprend la valeur par défaut des autres champs", () => {
    expect(parseNotificationPreferences({ messages: false, sound: "non", unknown: true })).toEqual({ ...defaultNotificationPreferences, messages: false });
    expect(parseNotificationPreferences(null)).toEqual(defaultNotificationPreferences);
  });

  it("une catégorie désactivée coupe le push de son type seulement", () => {
    const preferences = parseNotificationPreferences({ messages: false });
    expect(isPushEnabled(preferences, "message")).toBe(false);
    expect(isPushEnabled(preferences, "evaluation")).toBe(true);
    expect(isPushEnabled(preferences, "tutor-request")).toBe(true);
    expect(isPushEnabled(preferences, "autre")).toBe(true);
  });

  it("masque le texte sur l'écran verrouillé si demandé", () => {
    const notification = { title: "Message de Sam", body: "Je serai en retard" };
    expect(pushText(defaultNotificationPreferences, notification)).toEqual(notification);
    expect(pushText(parseNotificationPreferences({ lockScreenContent: false }), notification)).toEqual(hiddenNotificationText);
  });
});
