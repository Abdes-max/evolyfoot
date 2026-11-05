import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../lib/auth-context";

interface MessageNotification {
  kind: string;
  link: string;
  read: boolean;
}

// Onglet Messages : un fil par joueur de l'effectif, ceux qui ont un message non lu en tête
// (repérés par les notifications « message », dont le lien pointe vers /equipe/:id).
export default function MessagesListScreen() {
  const { roster, apiRequest } = useAuth();
  const [unread, setUnread] = useState<ReadonlySet<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const response = await apiRequest("/api/notifications");
        const body = response?.ok ? await response.json().catch(() => null) : null;
        const notifications: MessageNotification[] = Array.isArray(body?.notifications) ? body.notifications : [];
        setUnread(
          new Set(
            notifications
              .filter((notification) => notification.kind === "message" && !notification.read)
              .map((notification) => notification.link.split("/").pop() ?? ""),
          ),
        );
      })();
    }, [apiRequest]),
  );

  const players = [...roster].sort((a, b) => Number(unread.has(b.id)) - Number(unread.has(a.id)) || a.name.localeCompare(b.name, "fr"));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.step}>MESSAGES</Text>
        <Text style={styles.title}>Tes échanges avec les joueurs et les familles.</Text>
        {players.length === 0 ? (
          <Text style={styles.muted}>Ajoute des joueurs à ton effectif pour échanger avec eux.</Text>
        ) : (
          players.map((player) => (
            <TouchableOpacity
              accessibilityLabel={unread.has(player.id) ? `${player.name}, nouveau message` : player.name}
              accessibilityRole="button"
              key={player.id}
              onPress={() => router.push({ pathname: "/messages/[id]", params: { id: player.id, name: player.name } })}
              style={styles.row}
            >
              <Text style={styles.name}>{player.name}</Text>
              {unread.has(player.id) ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Nouveau</Text>
                </View>
              ) : (
                <Text style={styles.chevron}>›</Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 48, gap: 10 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  title: { fontSize: 24, fontWeight: "800", color: colors.ink, marginBottom: spacing.sm },
  muted: { fontSize: 12, lineHeight: 18, color: colors.muted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
  },
  name: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  chevron: { color: colors.muted, fontSize: 20, fontWeight: "800" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: colors.primary },
  badgeText: { color: colors.primaryInk, fontSize: 10.5, fontWeight: "900" },
});
