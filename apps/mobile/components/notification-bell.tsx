import { colors } from "@evolyfoot/design-tokens";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { useUnread } from "../lib/push";
import { themedStyles } from "../lib/themed-styles";
import { BellIcon } from "./icons";

// Cloche de l'en-tête : ouvre les notifications, avec le nombre de non lues bien visible.
export function NotificationBell() {
  const { sessionToken } = useAuth();
  const { unreadCount } = useUnread(sessionToken);
  return (
    <TouchableOpacity
      accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} non lues` : ""}`}
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => router.push("/notifications")}
      style={styles.button}
    >
      <BellIcon color={colors.ink} size={22} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// Pastille rouge chiffrée, partagée avec la barre d'onglets.
export function CountBadge({ count, style }: { count: number; style?: object }) {
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    button: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    badge: {
      position: "absolute",
      top: -4,
      right: -4,
      minWidth: 19,
      height: 19,
      paddingHorizontal: 5,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#ef4444",
      borderWidth: 2,
      borderColor: colors.paper,
    },
    badgeText: { color: "#ffffff", fontSize: 10.5, fontWeight: "900" },
  }),
);
