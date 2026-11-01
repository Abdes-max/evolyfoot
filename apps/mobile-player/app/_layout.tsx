import { router, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "../lib/auth-context";

function AuthGate({ children }: { children: ReactNode }) {
  const { sessionToken, restoring } = useAuth();
  const pathname = usePathname();

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
