import { colors, spacing } from "@evolyfoot/design-tokens";
import { Link, router, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { useUnread } from "../lib/push";

const tabs = [
  { href: "/", label: "Ma carte" },
  { href: "/calendrier", label: "Calendrier" },
  { href: "/progression", label: "Progrès" },
  { href: "/messages", label: "Messages" },
] as const;

export function TabBar() {
  const pathname = usePathname();
  const { sessionToken } = useAuth();
  const { unreadMessages } = useUnread(sessionToken);
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link asChild href={tab.href} key={tab.href}>
            <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: active }} style={styles.tab}>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.label}
                {tab.href === "/messages" && unreadMessages > 0 && !active ? ` · ${unreadMessages > 9 ? "9+" : unreadMessages}` : ""}
              </Text>
              {tab.href === "/messages" && unreadMessages > 0 && !active && (
                <View accessibilityLabel={`${unreadMessages} messages non lus`} style={styles.unreadDot} />
              )}
              <View style={[styles.tabLine, active && styles.tabLineActive]} />
            </TouchableOpacity>
          </Link>
        );
      })}
    </View>
  );
}

export function Screen({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        {/* Retour sur chaque page sauf la carte (accueil) ; sans historique, ramène à l'accueil. */}
        {pathname !== "/" ? (
          <TouchableOpacity
            accessibilityLabel="Retour"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            style={styles.back}
          >
            <Text style={styles.backText}>‹ Retour</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {action}
        </View>
        <View style={styles.horizon} />
        {children}
      </ScrollView>
      <TabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  unreadDot: { position: "absolute", top: 6, right: 14, width: 9, height: 9, borderRadius: 5, backgroundColor: "#ef4444" },
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingTop: 56, paddingBottom: spacing.xl },
  back: { alignSelf: "flex-start", marginTop: -36, marginBottom: spacing.sm, paddingVertical: 6 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  title: {
    flex: 1,
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    textTransform: "uppercase",
    textShadowColor: colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  horizon: { height: 2, marginTop: spacing.sm, marginBottom: spacing.lg, backgroundColor: colors.primary, opacity: 0.8 },
  tabBar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.primaryDark, backgroundColor: colors.surface, paddingBottom: spacing.md },
  tab: { flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 6 },
  tabLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  tabLabelActive: { color: colors.primary },
  tabLine: { width: 28, height: 2, backgroundColor: "transparent" },
  tabLineActive: { backgroundColor: colors.lime },
});
