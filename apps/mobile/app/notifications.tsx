import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth-context";
import { readUnread } from "../lib/push";
import { themedStyles } from "../lib/themed-styles";

interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

function routeFor(item: Pick<NotificationItem, "kind" | "link">): string | null {
  const link = item.link;
  // Demande d’accès d’un tuteur : la fiche du joueur, où l’accepter ou la refuser.
  if (item.kind === "tutor-request") {
    const player = link.match(/^\/equipe\/([^/?#]+)/)?.[1];
    return player ? `/equipe/${player}` : "/equipe";
  }
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
    const route = routeFor(item);
    if (route) router.push(route as never);
  }

  const unread = items?.filter((item) => !item.read).length ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.head}>
          <Text style={styles.title}>Notifications</Text>
          {unread > 0 && (
            <TouchableOpacity accessibilityRole="button" hitSlop={8} onPress={() => markRead({ all: true })}>
              <Text style={styles.link}>Tout marquer lu</Text>
            </TouchableOpacity>
          )}
        </View>
        {items === null && <Text style={styles.muted}>Chargement…</Text>}
        {items?.length === 0 && <Text style={styles.muted}>Rien de nouveau pour l’instant.</Text>}
        {items?.map((item) => (
          <TouchableOpacity accessibilityRole="button" key={item.id} onPress={() => open(item)} style={[styles.item, !item.read && styles.unread]}>
            <View style={styles.itemHead}>
              {!item.read ? <View style={styles.dot} /> : null}
              <Text style={styles.itemTitle}>{item.title}</Text>
            </View>
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

const styles = themedStyles(() =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
    page: { width: "100%", maxWidth: 640, alignSelf: "center", padding: spacing.lg, paddingBottom: 48, gap: 10 },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
    back: { fontSize: 12, fontWeight: "800", color: colors.primary },
    title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 6 },
    link: { fontSize: 13, fontWeight: "800", color: colors.primary },
    muted: { fontSize: 11, color: colors.muted },
    item: { width: "100%", padding: 14, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, gap: 6 },
    unread: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    itemHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    itemTitle: { flex: 1, flexShrink: 1, fontSize: 14, fontWeight: "800", color: colors.ink },
    body: { flexShrink: 1, fontSize: 13, lineHeight: 19, color: colors.ink },
  }),
);
