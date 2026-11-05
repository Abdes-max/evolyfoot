import { colors } from "@evolyfoot/design-tokens";
import { router, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { View } from "react-native";
import { CoachTabBar } from "../components/coach-tab-bar";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { usePushNotifications } from "../lib/push";

// Lien web d’une notification → écran de l’appli Coach.
function routeForLink(link: string): string {
  const player = link.match(/^\/equipe\/([^/?#]+)/);
  return player ? `/messages/${player[1]}` : "/notifications";
}

const PUBLIC_ROUTES = ["/connexion", "/inscription"];

// Écrans racines (onglets) : pas d'en-tête, la barre du bas sert de navigation.
const TAB_SCREENS = ["index", "seances", "match", "messages/index", "equipe"];
// Plein écran : ni en-tête ni onglets (connexion, premier paramétrage, mode terrain).
const FULL_SCREENS = ["connexion", "inscription", "onboarding", "terrain/[id]"];

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
            // Les autres écrans gardent l'en-tête natif : bouton Retour en haut à gauche et retour
            // par glissement depuis le bord, comme partout sur iOS.
            headerShown: !TAB_SCREENS.includes(route.name) && !FULL_SCREENS.includes(route.name),
            headerTitle: "",
            headerBackTitle: "Retour",
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

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthGate>
        <Navigation />
      </AuthGate>
    </AuthProvider>
  );
}
