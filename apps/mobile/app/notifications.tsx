import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { readUnread } from "../lib/push";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

function routeFor(link: string): string | null {
  // /messagerie?joueur=:id (ou /equipe/:id pour les anciennes alertes) → fil de ce joueur.
  const player = link.match(/[?&]joueur=([^&#]+)/)?.[1] ?? link.match(/^\/equipe\/([^/?#]+)/)?.[1];
  return player ? `/messages/${player}` : null;
}

// Alertes du coach : messages des joueurs et de leurs parents. Toucher une alerte ouvre le fil.
export default function NotificationsScreen() {
  const { apiRequest, sessionToken } = useAuth();
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  const load = useCallback(async () => {
    const response = await apiRequest("/api/notifications");
    const body = response?.ok ? await response.json().catch(() => null) : null;
    setItems(body?.notifications ?? []);
    if (sessionToken) void readUnread(sessionToken);
  }, [apiRequest, sessionToken]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function markRead(body: { all: true } | { ids: string[] }) {
    await apiRequest("/api/notifications/read", { method: "POST", body: JSON.stringify(body) });
    await load();
  }

  async function open(item: NotificationItem) {
    if (!item.read) await markRead({ ids: [item.id] });
    const route = routeFor(item.link);
    if (route) router.push(route as never);
  }

  const unread = items?.filter((item) => !item.read).length ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.title}>Notifications</Text>
        {unread > 0 && (
          <TouchableOpacity accessibilityRole="button" onPress={() => markRead({ all: true })}>
            <Text style={styles.link}>Tout marquer lu</Text>
          </TouchableOpacity>
        )}
        {items === null && <Text style={styles.muted}>Chargement…</Text>}
        {items?.length === 0 && <Text style={styles.muted}>Rien de nouveau pour l’instant.</Text>}
        {items?.map((item) => (
          <TouchableOpacity accessibilityRole="button" key={item.id} onPress={() => open(item)} style={[styles.item, !item.read && styles.unread]}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.muted}>
              {new Date(item.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 48, gap: 10 },
  back: { fontSize: 12, fontWeight: "800", color: colors.primary },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 6 },
  link: { fontSize: 13, fontWeight: "800", color: colors.primary },
  muted: { fontSize: 11, color: colors.muted },
  item: { padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, gap: 3 },
  unread: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  itemTitle: { fontSize: 14, fontWeight: "800", color: colors.ink },
  body: { fontSize: 13, lineHeight: 18, color: colors.ink },
});
