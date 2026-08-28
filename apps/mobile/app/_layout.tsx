import { router, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "../lib/auth-context";

const PUBLIC_ROUTES = ["/connexion", "/inscription"];

function AuthGate({ children }: { children: ReactNode }) {
  const { educator } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!educator && !PUBLIC_ROUTES.includes(pathname)) {
      router.replace("/connexion");
    }
  }, [educator, pathname]);

  return <>{children}</>;
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
