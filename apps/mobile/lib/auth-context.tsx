import type { DiagnosticScores, ObservationDraft, PlayerReference, TeamProfile, TrainingSession } from "@evolyfoot/domain";
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
  diagnosticScores: DiagnosticScores | null;
  roster: readonly PlayerReference[];
  login(email: string, password: string): Promise<AuthResult>;
  register(email: string, password: string, displayName: string): Promise<AuthResult>;
  logout(): Promise<void>;
  saveTeam(profile: TeamProfile): Promise<AuthResult>;
  saveDiagnostic(scores: DiagnosticScores): Promise<AuthResult>;
  saveTrainingSession(session: TrainingSession): Promise<AuthResult>;
  saveObservation(draft: ObservationDraft): Promise<AuthResult>;
  addPlayer(name: string): Promise<AuthResult>;
  renamePlayer(id: string, name: string): Promise<AuthResult>;
  removePlayer(id: string): Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const GENERIC_ERROR = "Une erreur est survenue.";

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : GENERIC_ERROR;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [educator, setEducator] = useState<Educator | null>(null);
  const [team, setTeam] = useState<TeamProfile | null>(null);
  const [diagnosticScores, setDiagnosticScores] = useState<DiagnosticScores | null>(null);
  const [roster, setRoster] = useState<readonly PlayerReference[]>([]);
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

  const fetchDiagnostic = useCallback(async (token: string) => {
    try {
      const response = await apiFetch("/api/diagnostic", { sessionToken: token });
      const body = await response.json().catch(() => ({ scores: null }));
      setDiagnosticScores(response.ok ? (body.scores ?? null) : null);
    } catch {
      setDiagnosticScores(null);
    }
  }, []);

  const fetchRoster = useCallback(async (token: string) => {
    try {
      const response = await apiFetch("/api/roster", { sessionToken: token });
      const body = await response.json().catch(() => ({ players: [] }));
      setRoster(response.ok ? (body.players ?? []) : []);
    } catch {
      setRoster([]);
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
      await Promise.all([fetchTeam(body.sessionToken), fetchDiagnostic(body.sessionToken), fetchRoster(body.sessionToken)]);
      return { ok: true };
    },
    [fetchTeam, fetchDiagnostic, fetchRoster],
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
      setDiagnosticScores(null);
      setRoster([]);
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
    setDiagnosticScores(null);
    setRoster([]);
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

  const saveDiagnostic = useCallback(
    async (scores: DiagnosticScores): Promise<AuthResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour enregistrer ce diagnostic." };
      }
      const response = await apiFetch("/api/diagnostic", {
        method: "PUT",
        sessionToken,
        body: JSON.stringify(scores),
      });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      const body = await response.json();
      setDiagnosticScores(body.scores);
      return { ok: true };
    },
    [sessionToken],
  );

  const saveTrainingSession = useCallback(
    async (session: TrainingSession): Promise<AuthResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour enregistrer cette séance." };
      }
      const response = await apiFetch("/api/sessions", {
        method: "POST",
        sessionToken,
        body: JSON.stringify({
          title: session.title,
          ageGroup: session.ageGroup,
          playerCount: session.playerCount,
          theme: session.theme,
          intention: session.intention,
          blocks: session.blocks.map((block) => ({
            id: block.id,
            activityId: block.activity.id,
            durationMinutes: block.durationMinutes,
          })),
        }),
      });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      return { ok: true };
    },
    [sessionToken],
  );

  const saveObservation = useCallback(
    async (draft: ObservationDraft): Promise<AuthResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour enregistrer cette observation." };
      }
      const response = await apiFetch("/api/observations", {
        method: "POST",
        sessionToken,
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      return { ok: true };
    },
    [sessionToken],
  );

  const addPlayer = useCallback(
    async (name: string): Promise<AuthResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour ajouter un joueur." };
      }
      const response = await apiFetch("/api/roster", { method: "POST", sessionToken, body: JSON.stringify({ name }) });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      const body = await response.json();
      setRoster((current) => [...current, body.player]);
      return { ok: true };
    },
    [sessionToken],
  );

  const renamePlayer = useCallback(
    async (id: string, name: string): Promise<AuthResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour renommer un joueur." };
      }
      const response = await apiFetch(`/api/roster/${id}`, { method: "PATCH", sessionToken, body: JSON.stringify({ name }) });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      const body = await response.json();
      setRoster((current) => current.map((player) => (player.id === id ? body.player : player)));
      return { ok: true };
    },
    [sessionToken],
  );

  const removePlayer = useCallback(
    async (id: string): Promise<AuthResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour retirer un joueur." };
      }
      const response = await apiFetch(`/api/roster/${id}`, { method: "DELETE", sessionToken });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      setRoster((current) => current.filter((player) => player.id !== id));
      return { ok: true };
    },
    [sessionToken],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      educator,
      team,
      diagnosticScores,
      roster,
      login,
      register,
      logout,
      saveTeam,
      saveDiagnostic,
      saveTrainingSession,
      saveObservation,
      addPlayer,
      renamePlayer,
      removePlayer,
    }),
    [
      educator,
      team,
      diagnosticScores,
      roster,
      login,
      register,
      logout,
      saveTeam,
      saveDiagnostic,
      saveTrainingSession,
      saveObservation,
      addPlayer,
      renamePlayer,
      removePlayer,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider.");
  }
  return context;
}
