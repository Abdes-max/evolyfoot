import { router, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { usePushNotifications } from "../lib/push";

// Lien web d’une notification → écran de l’appli Coach.
function routeForLink(link: string): string {
  const player = link.match(/^\/equipe\/([^/?#]+)/);
  return player ? `/messages/${player[1]}` : "/notifications";
}

const PUBLIC_ROUTES = ["/connexion", "/inscription"];

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

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGate>
    </AuthProvider>
  );
}
