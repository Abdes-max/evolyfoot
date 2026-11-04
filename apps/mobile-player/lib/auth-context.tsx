import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "./api";
import { unregisterPush } from "./push";
import { clearSessionToken, readSessionToken, writeSessionToken } from "./session-storage";

type AuthResult = { ok: true } | { ok: false; error: string };

interface AuthContextValue {
  sessionToken: string | null;
  restoring: boolean;
  login(email: string, password: string): Promise<AuthResult>;
  logout(): Promise<void>;
  deleteAccount(password: string): Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const GENERIC_ERROR = "Une erreur est survenue, réessaie.";

async function readRole(token: string): Promise<string | null> {
  const response = await apiFetch("/api/auth/session", { sessionToken: token }).catch(() => null);
  const body = await response?.json().catch(() => null);
  return body?.role ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const response = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    if (!response) {
      return { ok: false, error: GENERIC_ERROR };
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.sessionToken) {
      return { ok: false, error: typeof body.error === "string" ? body.error : GENERIC_ERROR };
    }
    if ((await readRole(body.sessionToken)) !== "player") {
      await apiFetch("/api/auth/logout", { method: "POST", sessionToken: body.sessionToken }).catch(() => undefined);
      return { ok: false, error: "Ce compte est un compte éducateur : connecte-toi sur EvolyFoot Coach." };
    }
    setSessionToken(body.sessionToken);
    await writeSessionToken(body.sessionToken);
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    if (sessionToken) {
      await unregisterPush(sessionToken);
      await apiFetch("/api/auth/logout", { method: "POST", sessionToken }).catch(() => undefined);
    }
    setSessionToken(null);
    await clearSessionToken();
  }, [sessionToken]);

  const deleteAccount = useCallback(
    async (password: string): Promise<AuthResult> => {
      const response = await apiFetch("/api/account", { method: "DELETE", sessionToken, body: JSON.stringify({ password }) }).catch(() => null);
      if (!response) {
        return { ok: false, error: GENERIC_ERROR };
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return { ok: false, error: typeof body.error === "string" ? body.error : GENERIC_ERROR };
      }
      await logout();
      return { ok: true };
    },
    [logout, sessionToken],
  );

  // Reprend la session enregistrée au lancement. Une panne réseau conserve le jeton, pour ne pas
  // déconnecter le joueur parce que le terrain n'a pas de réseau.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await readSessionToken();
      if (token) {
        const response = await apiFetch("/api/auth/session", { sessionToken: token }).catch(() => null);
        const body = response && response.status < 500 ? await response.json().catch(() => null) : null;
        if (!response || response.status >= 500) {
          if (!cancelled) {
            setSessionToken(token);
          }
        } else if (body?.role === "player") {
          if (!cancelled) {
            setSessionToken(token);
          }
        } else {
          await clearSessionToken();
        }
      }
      if (!cancelled) {
        setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ sessionToken, restoring, login, logout, deleteAccount }), [sessionToken, restoring, login, logout, deleteAccount]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé dans AuthProvider.");
  }
  return context;
}
