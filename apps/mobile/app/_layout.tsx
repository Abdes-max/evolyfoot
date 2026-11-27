import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ReactNode } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CoachTabBar } from "../components/coach-tab-bar";
import { SetupGuide } from "../components/setup-guide";
import { NotificationBell } from "../components/notification-bell";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { fetchBilling, type BillingState } from "../lib/billing";
import { usePushNotifications } from "../lib/push";
import { ThemeProvider, useTheme } from "../lib/theme";

// Lien web d’une notification → écran de l’appli Coach.
function routeForLink(link: string): string {
  // /equipe/:id (demande d’accès d’un tuteur) → fiche du joueur, où l’accepter ou la refuser.
  const rosterPlayer = link.match(/^\/equipe\/([^/?#]+)/)?.[1];
  if (rosterPlayer) return `/equipe/${rosterPlayer}`;
  // /messagerie?joueur=:id → fil de ce joueur.
  const player = link.match(/[?&]joueur=([^&#]+)/)?.[1];
  return player ? `/messages/${player}` : "/notifications";
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Abonnement résilié depuis (everSubscribed) : "ton abonnement a pris fin", pas "ton essai est
// terminé" -- même distinction que la page web /abonnement.
function billingPopupMessage(billing: BillingState): string {
  const ended =
    billing.everSubscribed && billing.currentPeriodEnd
      ? `Ton abonnement a pris fin le ${longDate(billing.currentPeriodEnd)}.`
      : "Ton essai de 14 jours est terminé.";
  return `${ended} Abonne-toi pour retrouver un accès complet à EvolyFoot.`;
}

const PUBLIC_ROUTES = ["/connexion", "/inscription"];

// Seul le profil reste ouvert quand l'essai est terminé et que l'accès est bloqué (BILLING_ENFORCED) :
// l'abonnement se prend sur le site (règle 3.1.1 de l'App Store), le profil y renvoie déjà.
const BILLING_OPEN_ROUTES = ["/profil", ...PUBLIC_ROUTES];

// Sans en-tête : l'accueil (point de départ), la connexion/inscription et le mode terrain (qui a
// son propre bouton « Quitter »). Partout ailleurs, un bouton Retour en haut à gauche.
const NO_HEADER_SCREENS = ["index", "connexion", "inscription", "terrain/[id]"];

// Revient à l'écran précédent ; un onglet ouvert directement (sans historique) ramène à l'accueil.
function BackButton() {
  return (
    <TouchableOpacity
      accessibilityLabel="Retour"
      accessibilityRole="button"
      hitSlop={12}
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      style={{ paddingVertical: 6, paddingLeft: 8, paddingRight: 12 }}
    >
      <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "800" }}>‹ Retour</Text>
    </TouchableOpacity>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { educator, restoring, sessionToken, apiRequest } = useAuth();
  const pathname = usePathname();
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [billingPopupDismissed, setBillingPopupDismissed] = useState(false);
  const billingBlocked = billing?.enforced === true && billing.access.state === "expired";
  usePushNotifications(sessionToken, routeForLink);

  useEffect(() => {
    if (!restoring && !educator && !PUBLIC_ROUTES.includes(pathname)) {
      router.replace("/connexion");
    }
  }, [educator, pathname, restoring]);

  useEffect(() => {
    if (!educator) return;
    let cancelled = false;
    fetchBilling(apiRequest).then((result) => {
      if (!cancelled) setBilling(result);
    });
    return () => {
      cancelled = true;
    };
  }, [educator, apiRequest]);

  useEffect(() => {
    if (billingBlocked && !BILLING_OPEN_ROUTES.includes(pathname)) {
      router.replace("/profil");
    }
  }, [billingBlocked, pathname]);

  return (
    <>
      {restoring ? null : children}
      <Modal animationType="fade" transparent visible={billingBlocked && !billingPopupDismissed}>
        <View style={styles.billingPopupOverlay}>
          <View style={styles.billingPopupCard}>
            <Text style={styles.billingPopupText}>{billing ? billingPopupMessage(billing) : ""}</Text>
            <TouchableOpacity onPress={() => setBillingPopupDismissed(true)} style={styles.billingPopupButton}>
              <Text style={styles.billingPopupButtonText}>S’abonner</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Navigation() {
  const { educator } = useAuth();
  const pathname = usePathname();
  const showTabs = Boolean(educator) && !PUBLIC_ROUTES.includes(pathname) && pathname !== "/onboarding" && !pathname.startsWith("/terrain/");

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={({ route }) => ({
            // En-tête natif (le glissement depuis le bord reste actif) avec un bouton Retour toujours
            // visible, y compris sur les onglets.
            headerShown: !NO_HEADER_SCREENS.includes(route.name),
            headerTitle: "",
            headerBackVisible: false,
            headerLeft: () => <BackButton />,
            // Cloche des notifications toujours en haut à droite, sauf sur l’écran des notifications.
            headerRight: route.name === "notifications" ? undefined : () => <NotificationBell />,
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.paper },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.paper },
          })}
        />
      </View>
      {showTabs ? <SetupGuide /> : null}
      {showTabs ? <CoachTabBar /> : null}
    </View>
  );
}

// Barre d'état claire sur le thème sombre, sombre sur le thème clair.
function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme === "light" ? "dark" : "light"} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedStatusBar />
        <AuthGate>
          <Navigation />
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  billingPopupOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  billingPopupCard: {
    gap: spacing.md,
    maxWidth: 360,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  billingPopupText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  billingPopupButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  billingPopupButtonText: {
    color: colors.primaryInk,
    fontSize: 16,
    fontWeight: "800",
  },
});
