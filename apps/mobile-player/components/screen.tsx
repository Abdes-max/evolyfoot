import { colors, spacing } from "@evolyfoot/design-tokens";
import { Link, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const tabs = [
  { href: "/", label: "Ma carte" },
  { href: "/calendrier", label: "Calendrier" },
  { href: "/progression", label: "Progrès" },
  { href: "/messages", label: "Messages" },
] as const;

export function TabBar() {
  const pathname = usePathname();
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link asChild href={tab.href} key={tab.href}>
            <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: active }} style={styles.tab}>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              <View style={[styles.tabLine, active && styles.tabLineActive]} />
            </TouchableOpacity>
          </Link>
        );
      })}
    </View>
  );
}

export function Screen({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
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
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingTop: 56, paddingBottom: spacing.xl },
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
