// Réglages de notification d'un compte (coach, joueur ou tuteur), appliqués à l'envoi des push.
export const notificationCategories = ["messages", "evaluations", "requests"] as const;
export type NotificationCategory = (typeof notificationCategories)[number];

export const notificationCategoryLabels: Record<NotificationCategory, { label: string; hint: string }> = {
  messages: { label: "Messages", hint: "Un message du coach, d’un joueur ou d’un parent." },
  evaluations: { label: "Évaluations", hint: "Une nouvelle évaluation de ton coach." },
  requests: { label: "Demandes de suivi", hint: "Un compte demande à suivre un joueur." },
};

export interface NotificationPreferences {
  // Une notification par catégorie : désactivée, aucun push (elle reste dans la liste de l'appli).
  readonly messages: boolean;
  readonly evaluations: boolean;
  readonly requests: boolean;
  // Écran verrouillé : afficher le texte, ou seulement « Nouvelle notification EvolyFoot ».
  readonly lockScreenContent: boolean;
  // Bandeau quand l'appli est ouverte (téléphone déverrouillé).
  readonly inAppBanner: boolean;
  readonly sound: boolean;
}

export const defaultNotificationPreferences: NotificationPreferences = {
  messages: true,
  evaluations: true,
  requests: true,
  lockScreenContent: true,
  inAppBanner: true,
  sound: true,
};

// Réglages reçus d'un formulaire ou lus en base : toute valeur absente ou invalide reprend sa valeur par défaut.
export function parseNotificationPreferences(value: unknown): NotificationPreferences {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const pick = (key: keyof NotificationPreferences) => (typeof source[key] === "boolean" ? (source[key] as boolean) : defaultNotificationPreferences[key]);
  return {
    messages: pick("messages"),
    evaluations: pick("evaluations"),
    requests: pick("requests"),
    lockScreenContent: pick("lockScreenContent"),
    inAppBanner: pick("inAppBanner"),
    sound: pick("sound"),
  };
}

const categoryOfKind: Readonly<Record<string, NotificationCategory>> = {
  message: "messages",
  evaluation: "evaluations",
  "tutor-request": "requests",
};

// Faut-il prévenir par push pour ce type de notification ? Un type inconnu prévient toujours.
export function isPushEnabled(preferences: NotificationPreferences, kind: string): boolean {
  const category = categoryOfKind[kind];
  return category ? preferences[category] : true;
}

export const hiddenNotificationText = { title: "EvolyFoot", body: "Nouvelle notification" } as const;

// Texte affiché sur l'écran verrouillé : masqué quand le compte ne veut pas de contenu.
export function pushText(preferences: NotificationPreferences, notification: { title: string; body: string }): { title: string; body: string } {
  return preferences.lockScreenContent ? { title: notification.title, body: notification.body } : { ...hiddenNotificationText };
}
