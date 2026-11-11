import { router, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { usePushNotifications } from "../lib/push";
import { ThemeProvider, useTheme } from "../lib/theme";

// Lien web d’une notification → écran de l’appli Player.
function routeForLink(link: string): string {
  return link.startsWith("/joueur/messages") ? "/messages" : "/";
}

function AuthGate({ children }: { children: ReactNode }) {
  const { sessionToken, restoring } = useAuth();
  const pathname = usePathname();
  usePushNotifications(sessionToken, routeForLink);

  useEffect(() => {
    if (!restoring && !sessionToken && pathname !== "/connexion") {
      router.replace("/connexion");
    }
  }, [sessionToken, pathname, restoring]);

  return <>{restoring ? null : children}</>;
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
          <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
}
