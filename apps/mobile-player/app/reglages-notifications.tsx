import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import {
  defaultNotificationPreferences,
  notificationCategories,
  notificationCategoryLabels,
  parseNotificationPreferences,
  type NotificationPreferences,
} from "@evolyfoot/domain";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { applyForegroundPreferences } from "../lib/push";

function Row({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        onValueChange={onChange}
        thumbColor={colors.paper}
        trackColor={{ false: colors.line, true: colors.primary }}
        value={value}
      />
    </View>
  );
}

// Réglages de notification du compte : catégories, texte sur l'écran verrouillé, bandeau appli ouverte, son.
// Enregistrés sur le serveur (le push est filtré à l'envoi), donc valables sur tous les téléphones du compte.
export default function NotificationSettingsScreen() {
  const { sessionToken } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await apiFetch("/api/notification-preferences", { sessionToken }).catch(() => null);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (cancelled) return;
      if (body?.preferences) setPreferences(parseNotificationPreferences(body.preferences));
      else setError("Impossible de charger tes réglages.");
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  // Enregistre à chaque bascule ; en cas d'échec, l'ancien réglage est restauré.
  async function change(patch: Partial<NotificationPreferences>) {
    const previous = preferences;
    const next = { ...preferences, ...patch };
    setPreferences(next);
    setError("");
    applyForegroundPreferences(next);
    const response = await apiFetch("/api/notification-preferences", { method: "PUT", sessionToken, body: JSON.stringify(next) }).catch(() => null);
    if (!response?.ok) {
      setPreferences(previous);
      applyForegroundPreferences(previous);
      setError("L’enregistrement a échoué, réessaie.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.body}>Choisis ce qui te prévient et comment, sur l’écran verrouillé comme téléphone en main.</Text>

        <Text style={styles.section}>Me prévenir pour</Text>
        <View style={styles.card}>
          {notificationCategories.map((category) => (
            <Row
              hint={notificationCategoryLabels[category].hint}
              key={category}
              label={notificationCategoryLabels[category].label}
              onChange={(value) => void change({ [category]: value })}
              value={preferences[category]}
            />
          ))}
        </View>

        <Text style={styles.section}>Affichage</Text>
        <View style={styles.card}>
          <Row
            hint="Sur l’écran verrouillé, montre l’expéditeur et le message. Désactivé : « Nouvelle notification »."
            label="Contenu sur l’écran verrouillé"
            onChange={(value) => void change({ lockScreenContent: value })}
            value={preferences.lockScreenContent}
          />
          <Row
            hint="Un bandeau en haut de l’écran quand EvolyFoot Player est ouverte."
            label="Bandeau appli ouverte"
            onChange={(value) => void change({ inAppBanner: value })}
            value={preferences.inAppBanner}
          />
          <Row hint="Un son à l’arrivée d’une notification." label="Son" onChange={(value) => void change({ sound: value })} value={preferences.sound} />
        </View>

        {!loaded ? <Text style={styles.hint}>Chargement…</Text> : null}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Text style={styles.hint}>
          Les bandeaux et l’écran verrouillé dépendent aussi des réglages de ton téléphone : autorise les notifications pour EvolyFoot Player si tu n’en reçois
          pas.
        </Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.system}>
          <Text style={styles.systemText}>Ouvrir les réglages du téléphone</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingTop: 56, paddingBottom: 48 },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", marginBottom: 4 },
  backText: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  title: { fontSize: 30, fontWeight: "800", color: colors.ink },
  body: { fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 8 },
  section: { color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", marginTop: 24, marginBottom: 8 },
  card: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLabel: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  rowHint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 16 },
  error: { color: colors.danger, fontSize: 13, fontWeight: "700", marginTop: 12 },
  system: { minHeight: 48, marginTop: 12, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.primary },
  systemText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
});
