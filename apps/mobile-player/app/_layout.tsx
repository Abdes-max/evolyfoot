import { router, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { usePushNotifications } from "../lib/push";

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

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
      </AuthGate>
    </AuthProvider>
  );
}
