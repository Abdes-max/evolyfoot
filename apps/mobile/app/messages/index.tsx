import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { playerPositionCodes, playerPositions } from "@evolyfoot/domain";
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
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {player.name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0]!.toUpperCase())
                    .join("")}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{player.name}</Text>
                <Text style={styles.meta}>
                  {player.position && (playerPositions as readonly string[]).includes(player.position)
                    ? `${player.position} (${playerPositionCodes[player.position as keyof typeof playerPositionCodes]})`
                    : "Joueur ou tuteur"}
                </Text>
              </View>
              {unread.has(player.id) ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Nouveau</Text>
                </View>
              ) : (
                <Text style={styles.number}>{player.jerseyNumber || "›"}</Text>
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
    gap: 12,
    padding: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
  },
  name: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  avatarText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  number: { color: "rgba(255,255,255,0.28)", fontSize: 22, fontWeight: "900", fontStyle: "italic" },
  chevron: { color: colors.muted, fontSize: 20, fontWeight: "800" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: colors.primary },
  badgeText: { color: colors.primaryInk, fontSize: 10.5, fontWeight: "900" },
});
