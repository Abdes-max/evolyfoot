import type { TeamProfile } from "@evolyfoot/domain";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "./api";

export interface Educator {
  id: string;
  email: string;
  displayName: string;
}

export type AuthResult = { ok: true } | { ok: false; error: string };

export interface AuthContextValue {
  educator: Educator | null;
  team: TeamProfile | null;
  login(email: string, password: string): Promise<AuthResult>;
  register(email: string, password: string, displayName: string): Promise<AuthResult>;
  logout(): Promise<void>;
  saveTeam(profile: TeamProfile): Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const GENERIC_ERROR = "Une erreur est survenue.";

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : GENERIC_ERROR;
}

// Pas de stockage persistant sur mobile pour l'instant (voir docs/architecture.md) : la session
// vit uniquement en mémoire tant que l'application tourne et se perd à son redémarrage complet.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [educator, setEducator] = useState<Educator | null>(null);
  const [team, setTeam] = useState<TeamProfile | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const fetchTeam = useCallback(async (token: string) => {
    try {
      const response = await apiFetch("/api/team", { sessionToken: token });
      const body = await response.json().catch(() => ({ profile: null }));
      setTeam(response.ok ? (body.profile ?? null) : null);
    } catch {
      setTeam(null);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      const body = await response.json();
      setEducator(body.educator);
      setSessionToken(body.sessionToken);
      await fetchTeam(body.sessionToken);
      return { ok: true };
    },
    [fetchTeam],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string): Promise<AuthResult> => {
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName }),
      });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      const body = await response.json();
      setEducator(body.educator);
      setSessionToken(body.sessionToken);
      setTeam(null);
      return { ok: true };
    },
    [],
  );

  const logout = useCallback(async () => {
    if (sessionToken) {
      await apiFetch("/api/auth/logout", { method: "POST", sessionToken }).catch(() => undefined);
    }
    setEducator(null);
    setTeam(null);
    setSessionToken(null);
  }, [sessionToken]);

  const saveTeam = useCallback(
    async (profile: TeamProfile): Promise<AuthResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour enregistrer ton équipe." };
      }
      const response = await apiFetch("/api/team", {
        method: "PUT",
        sessionToken,
        body: JSON.stringify(profile),
      });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      const body = await response.json();
      setTeam(body.profile);
      return { ok: true };
    },
    [sessionToken],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ educator, team, login, register, logout, saveTeam }),
    [educator, team, login, register, logout, saveTeam],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l’intérieur d’un AuthProvider.");
  }
  return context;
}
