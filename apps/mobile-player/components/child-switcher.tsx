import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth-context";

interface Child {
  playerId: string;
  name: string;
  displayed: boolean;
}

interface Notice {
  kind: string;
  link: string;
  read: boolean;
}

// Sélecteur d’enfant, visible seulement quand le compte en suit plusieurs : la carte, le
// calendrier, les progrès et la discussion suivent l’enfant choisi. Pastille = messages non lus de
// la discussion de cet enfant.
export function ChildSwitcher({ onChange }: { onChange: () => void }) {
  const { sessionToken } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const [childrenResponse, noticesResponse] = await Promise.all([
      apiFetch("/api/joueur/enfants", { sessionToken }).catch(() => null),
      apiFetch("/api/notifications", { sessionToken }).catch(() => null),
    ]);
    const childrenBody = childrenResponse?.ok ? await childrenResponse.json().catch(() => null) : null;
    const noticesBody = noticesResponse?.ok ? await noticesResponse.json().catch(() => null) : null;
    setChildren(Array.isArray(childrenBody?.children) ? childrenBody.children : []);
    const counts: Record<string, number> = {};
    for (const notice of (noticesBody?.notifications ?? []) as Notice[]) {
      const playerId = notice.link.match(/[?&]enfant=([^&#]+)/)?.[1];
      if (notice.kind === "message" && !notice.read && playerId) counts[playerId] = (counts[playerId] ?? 0) + 1;
    }
    setUnread(counts);
  }, [sessionToken]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function choose(playerId: string) {
    const response = await apiFetch("/api/joueur/enfants", { method: "PUT", sessionToken, body: JSON.stringify({ playerId }) }).catch(() => null);
    if (response?.ok) {
      await load();
      onChange();
    }
  }

  if (children.length < 2) return null;

  return (
    <ScrollView contentContainerStyle={styles.row} horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      {children.map((child) => (
        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityState={{ selected: child.displayed }}
          key={child.playerId}
          onPress={() => (child.displayed ? undefined : void choose(child.playerId))}
          style={[styles.chip, child.displayed && styles.chipActive]}
        >
          <Text style={[styles.chipText, child.displayed && styles.chipTextActive]}>{child.name.split(" ")[0]}</Text>
          {(unread[child.playerId] ?? 0) > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread[child.playerId]}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginBottom: spacing.md, flexGrow: 0 },
  row: { gap: spacing.sm, paddingTop: 6, paddingRight: spacing.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  chipTextActive: { color: colors.primaryInk },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#e5383b" },
  badgeText: { color: "#ffffff", fontSize: 11, fontWeight: "900" },
});
