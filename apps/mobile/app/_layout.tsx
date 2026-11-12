import { colors } from "@evolyfoot/design-tokens";
import { router, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { CoachTabBar } from "../components/coach-tab-bar";
import { AuthProvider, useAuth } from "../lib/auth-context";
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

const PUBLIC_ROUTES = ["/connexion", "/inscription"];

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
  const { educator, restoring, sessionToken } = useAuth();
  const pathname = usePathname();
  usePushNotifications(sessionToken, routeForLink);

  useEffect(() => {
    if (!restoring && !educator && !PUBLIC_ROUTES.includes(pathname)) {
      router.replace("/connexion");
    }
  }, [educator, pathname, restoring]);

  return <>{restoring ? null : children}</>;
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
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.paper },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.paper },
          })}
        />
      </View>
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
