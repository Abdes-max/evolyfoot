import { colors, spacing } from "@evolyfoot/design-tokens";
import { Link, router, usePathname } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { pendingResponses, useDashboard } from "../lib/dashboard";
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
  const { unreadCount, unreadMessages } = useUnread(sessionToken);
  const { dashboard } = useDashboard();
  const [now] = useState(() => Date.now());
  // Notifications non lues hors messages : les nouvelles évaluations (Ma carte, Progrès).
  const unreadEvaluations = Math.max(unreadCount - unreadMessages, 0);
  const badges: Record<string, number> = {
    "/": unreadEvaluations,
    "/calendrier": dashboard ? pendingResponses(dashboard, now) : 0,
    "/progression": unreadEvaluations,
    "/messages": unreadMessages,
  };
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link asChild href={tab.href} key={tab.href}>
            <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: active }} style={styles.tab}>
              <View>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
                {(badges[tab.href] ?? 0) > 0 && !active ? (
                  <View accessibilityLabel={`${badges[tab.href]} nouveautés`} style={styles.badge}>
                    <Text style={styles.badgeText}>{badges[tab.href]! > 99 ? "99+" : badges[tab.href]}</Text>
                  </View>
                ) : null}
              </View>
              <View style={[styles.tabLine, active && styles.tabLineActive]} />
            </TouchableOpacity>
          </Link>
        );
      })}
    </View>
  );
}

export function Screen({
  title,
  action,
  children,
  stickToBottom = false,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  stickToBottom?: boolean;
}) {
  const scroll = useRef<ScrollView>(null);
  const pathname = usePathname();
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.page}
        onContentSizeChange={() => stickToBottom && scroll.current?.scrollToEnd({ animated: false })}
        ref={scroll}
      >
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
  badge: {
    position: "absolute",
    top: -12,
    right: -14,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5383b",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: "#ffffff", fontSize: 11, fontWeight: "900" },
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
