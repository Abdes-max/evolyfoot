import { colors, spacing } from "@evolyfoot/design-tokens";
import { router, usePathname } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth-context";
import { useUnread } from "../lib/push";

// Écrans racines de l'appli Coach, toujours visibles en bas comme dans l'appli Player. Les autres
// écrans s'ouvrent par-dessus avec l'en-tête natif (bouton Retour, glissement depuis le bord).
export const coachTabs = [
  { href: "/", label: "Accueil" },
  { href: "/saison", label: "Saison" },
  { href: "/match", label: "Matchs" },
  { href: "/messages", label: "Messages" },
  { href: "/equipe", label: "Équipe" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function CoachTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { sessionToken } = useAuth();
  const { unreadMessages } = useUnread(sessionToken);

  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {coachTabs.map((tab) => {
        const active = isActive(pathname, tab.href);
        const badge = tab.href === "/messages" && unreadMessages > 0 && !active;
        return (
          <TouchableOpacity
            accessibilityLabel={badge ? `${tab.label}, ${unreadMessages} non lus` : tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={tab.href}
            // Un onglet remplace l'écran courant au lieu de s'empiler : pas de pile infinie
            // d'onglets à remonter avec Retour.
            onPress={() => (active ? undefined : router.replace(tab.href))}
            style={styles.tab}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
            {badge ? <View style={styles.dot} /> : null}
            <View style={[styles.line, active && styles.lineActive]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.primaryDark, backgroundColor: colors.surface, paddingTop: spacing.xs },
  tab: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", gap: 6 },
  label: { color: colors.muted, fontSize: 11.5, fontWeight: "800" },
  labelActive: { color: colors.primary },
  line: { width: 24, height: 2, backgroundColor: "transparent" },
  lineActive: { backgroundColor: colors.lime },
  dot: { position: "absolute", top: 6, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: "#ef4444" },
});
