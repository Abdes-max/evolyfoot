import type {
  AttendanceEntry,
  DiagnosticScores,
  MatchLineupAssignment,
  MatchStatus,
  MatchVenue,
  ObservationDraft,
  ObservationEventType,
  ObservationReportRating,
  ObservationReportSummary,
  PlayerSignal,
  PersonalExercise,
  PlayerReference,
  SavedTrainingSession,
  SeasonEventInput,
  TeamProfile,
  TeamStats,
  TrainingSession,
} from "@evolyfoot/domain";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "./api";
import { clearSessionToken, readSessionToken, writeSessionToken } from "./session-storage";

export interface Educator {
  id: string;
  email: string;
  displayName: string;
  // "assistant" : adjoint qui travaille sur l'équipe d'un autre éducateur.
  role?: "coach" | "assistant";
}

export interface MobileMatch {
  id: string;
  opponent: string;
  dateLabel: string;
  venue: MatchVenue;
  gameFormat: number;
  formationId: string;
  status: MatchStatus;
  lineup: MatchLineupAssignment[];
  captainPlayerId: string | null;
  substitutePlayerIds: string[];
}

// `PlayerReference` (domaine) reste { id, name } -- générique, utilisé aussi pour les signaux
// d'observation. L'effectif a besoin en plus du prénom/nom séparés pour l'écran équipe.tsx (voir
// PersistedPlayer côté base).
export interface RosterPlayer extends PlayerReference {
  readonly firstName: string;
  readonly lastName: string;
}

export type AuthResult = { ok: true } | { ok: false; error: string };
export type MatchResult = { ok: true; match: MobileMatch } | { ok: false; error: string };
export type MatchListResult = { ok: true; matches: MobileMatch[] } | { ok: false; error: string };

// Créneau du cycle et rendez-vous, exigés par `POST /api/sessions`.
export interface SessionSlotInput {
  weekNumber: number;
  slot: number;
  meetingAt: string;
  attendance?: readonly AttendanceEntry[];
}

export interface SeasonData {
  events: SeasonEventInput[];
  cycleNumber: number;
  // Séances du cycle en cours, pour situer la semaine active.
  cycleSessions: readonly SavedTrainingSession[];
  // Vrai si une des listes n'a pas pu être lue : le calendrier affiché est alors incomplet.
  failed: boolean;
}

export interface ObservationListItem {
  id: string;
  eventType: ObservationEventType;
  title: string;
  dateLabel: string;
  summary: ObservationReportSummary;
}

export interface ObservationDetail extends ObservationListItem {
  players: readonly PlayerReference[];
  ratings: readonly ObservationReportRating[];
  signals: readonly PlayerSignal[];
  note?: string;
  matchId?: string;
}

export interface AuthContextValue {
  educator: Educator | null;
  // Vrai le temps de relire la session enregistrée au lancement de l'app.
  restoring: boolean;
  team: TeamProfile | null;
  diagnosticScores: DiagnosticScores | null;
  roster: readonly RosterPlayer[];
  login(email: string, password: string): Promise<AuthResult>;
  register(email: string, password: string, displayName: string): Promise<AuthResult>;
  logout(): Promise<void>;
  deleteAccount(password: string): Promise<AuthResult>;
  saveTeam(profile: TeamProfile): Promise<AuthResult>;
  saveDiagnostic(scores: DiagnosticScores): Promise<AuthResult>;
  saveTrainingSession(session: TrainingSession, slotInput: SessionSlotInput): Promise<AuthResult>;
  listSessions(): Promise<readonly SavedTrainingSession[]>;
  loadSeason(): Promise<SeasonData>;
  listPersonalExercises(): Promise<readonly PersonalExercise[]>;
  getPlayStyle(): Promise<string | null>;
  startNextCycle(): Promise<AuthResult>;
  saveObservation(draft: ObservationDraft, matchId?: string): Promise<AuthResult>;
  listObservations(): Promise<readonly ObservationListItem[]>;
  // `null` si les chiffres n'ont pas pu être lus.
  getTeamStats(): Promise<TeamStats | null>;
  // Appel authentifié brut, `null` sans réseau : pour les écrans qui lisent eux-mêmes la réponse.
  apiRequest(path: string, init?: Omit<RequestInit, "headers">): Promise<Response | null>;
  getObservation(id: string): Promise<{ ok: true; observation: ObservationDetail } | { ok: false; error: string }>;
  addPlayer(firstName: string, lastName: string): Promise<AuthResult>;
  renamePlayer(id: string, firstName: string, lastName: string): Promise<AuthResult>;
  removePlayer(id: string): Promise<AuthResult>;
  listMatches(): Promise<MatchListResult>;
  getMatch(id: string): Promise<MatchResult>;
  createMatch(input: { opponent: string; dateLabel: string; venue: MatchVenue; gameFormat: number; formationId?: string }): Promise<MatchResult>;
  updateMatchLineup(id: string, lineup: MatchLineupAssignment[], captainPlayerId: string | null): Promise<MatchResult>;
  changeMatchFormation(id: string, formationId: string): Promise<MatchResult>;
  markMatchPlayed(id: string): Promise<MatchResult>;
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
  const [roster, setRoster] = useState<readonly RosterPlayer[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

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
      const session = await apiFetch("/api/auth/session", { sessionToken: body.sessionToken }).catch(() => null);
      const sessionBody = await session?.json().catch(() => null);
      if (sessionBody?.role === "player") {
        await apiFetch("/api/auth/logout", { method: "POST", sessionToken: body.sessionToken }).catch(() => undefined);
        return { ok: false, error: "Ce compte est un compte joueur : connecte-toi sur EvolyFoot Player." };
      }
      // La session porte le rôle (éducateur ou adjoint), absent de la réponse de connexion.
      setEducator(sessionBody?.educator ?? body.educator);
      setSessionToken(body.sessionToken);
      await writeSessionToken(body.sessionToken);
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
      await writeSessionToken(body.sessionToken);
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
    await clearSessionToken();
  }, [sessionToken]);

  const deleteAccount = useCallback(
    async (password: string): Promise<AuthResult> => {
      const response = await apiFetch("/api/account", { method: "DELETE", sessionToken, body: JSON.stringify({ password }) }).catch(() => null);
      if (!response) {
        return { ok: false, error: GENERIC_ERROR };
      }
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      await logout();
      return { ok: true };
    },
    [logout, sessionToken],
  );

  // Reprend la session enregistrée au lancement. Un jeton refusé est effacé ; une panne réseau le
  // conserve, pour ne pas déconnecter l'éducateur parce que le terrain n'a pas de réseau.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await readSessionToken();
      if (!token) {
        return;
      }
      const response = await apiFetch("/api/auth/session", { sessionToken: token }).catch(() => null);
      if (!response || response.status >= 500) {
        return;
      }
      const body = await response.json().catch(() => ({ educator: null }));
      if (!body.educator) {
        await clearSessionToken();
        return;
      }
      if (cancelled) {
        return;
      }
      setEducator(body.educator);
      setSessionToken(token);
      await Promise.all([fetchTeam(token), fetchDiagnostic(token), fetchRoster(token)]);
    })().finally(() => {
      if (!cancelled) {
        setRestoring(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchTeam, fetchDiagnostic, fetchRoster]);

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
    async (session: TrainingSession, slotInput: SessionSlotInput): Promise<AuthResult> => {
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
          weekNumber: slotInput.weekNumber,
          slot: slotInput.slot,
          meetingAt: slotInput.meetingAt,
          ...(slotInput.attendance && slotInput.attendance.length > 0 ? { attendance: slotInput.attendance } : {}),
        }),
      });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      return { ok: true };
    },
    [sessionToken],
  );

  const listSessions = useCallback(async (): Promise<readonly SavedTrainingSession[]> => {
    if (!sessionToken) {
      return [];
    }
    const response = await apiFetch("/api/sessions", { sessionToken }).catch(() => null);
    if (!response?.ok) {
      return [];
    }
    const body = await response.json().catch(() => ({ sessions: [] }));
    return body.sessions ?? [];
  }, [sessionToken]);

  const loadSeason = useCallback(async (): Promise<SeasonData> => {
    let failed = false;
    const read = async <Item,>(path: string, key: string): Promise<{ items: Item[]; body: Record<string, unknown> }> => {
      const response = await apiFetch(path, { sessionToken }).catch(() => null);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (!body) {
        failed = true;
        return { items: [], body: {} };
      }
      return { items: (body[key] as Item[]) ?? [], body };
    };
    const [season, cycle, matches, tournaments, plateaux] = await Promise.all([
      read<{ id: string; title: string; meetingAt: string | null }>("/api/sessions?scope=season", "sessions"),
      read<SavedTrainingSession>("/api/sessions", "sessions"),
      read<{ id: string; opponent: string; date: string | null }>("/api/matches", "matches"),
      read<{ id: string; name: string; date: string | null }>("/api/tournaments", "tournaments"),
      read<{ id: string; name: string; date: string | null }>("/api/plateaux", "plateaux"),
    ]);
    return {
      events: [
        ...season.items.map((session) => ({ id: session.id, type: "session" as const, title: session.title, date: session.meetingAt })),
        ...matches.items.map((match) => ({ id: match.id, type: "match" as const, title: `Contre ${match.opponent}`, date: match.date })),
        ...tournaments.items.map((tournament) => ({ id: tournament.id, type: "tournament" as const, title: tournament.name, date: tournament.date })),
        ...plateaux.items.map((plateau) => ({ id: plateau.id, type: "plateau" as const, title: plateau.name, date: plateau.date })),
      ],
      cycleNumber: typeof cycle.body.cycleNumber === "number" ? cycle.body.cycleNumber : 1,
      cycleSessions: cycle.items,
      failed,
    };
  }, [sessionToken]);

  const apiRequest = useCallback(
    (path: string, init: Omit<RequestInit, "headers"> = {}): Promise<Response | null> => apiFetch(path, { ...init, sessionToken }).catch(() => null),
    [sessionToken],
  );

  const getTeamStats = useCallback(async (): Promise<TeamStats | null> => {
    const response = await apiFetch("/api/stats", { sessionToken }).catch(() => null);
    const body = response?.ok ? await response.json().catch(() => null) : null;
    return body?.stats ?? null;
  }, [sessionToken]);

  const listObservations = useCallback(async (): Promise<readonly ObservationListItem[]> => {
    const response = await apiFetch("/api/observations", { sessionToken }).catch(() => null);
    const body = response?.ok ? await response.json().catch(() => null) : null;
    return body?.observations ?? [];
  }, [sessionToken]);

  const getObservation = useCallback(
    async (id: string): Promise<{ ok: true; observation: ObservationDetail } | { ok: false; error: string }> => {
      const response = await apiFetch(`/api/observations/${encodeURIComponent(id)}`, { sessionToken }).catch(() => null);
      if (!response) {
        return { ok: false, error: GENERIC_ERROR };
      }
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      const body = await response.json().catch(() => null);
      return body?.observation ? { ok: true, observation: body.observation } : { ok: false, error: GENERIC_ERROR };
    },
    [sessionToken],
  );

  const startNextCycle = useCallback(async (): Promise<AuthResult> => {
    const response = await apiFetch("/api/cycles/next", { method: "POST", sessionToken }).catch(() => null);
    if (!response) {
      return { ok: false, error: GENERIC_ERROR };
    }
    return response.ok ? { ok: true } : { ok: false, error: await readErrorMessage(response) };
  }, [sessionToken]);

  const getPlayStyle = useCallback(async (): Promise<string | null> => {
    const response = await apiFetch("/api/profile", { sessionToken }).catch(() => null);
    const body = await response?.json().catch(() => null);
    return body?.profile?.playStyle ?? null;
  }, [sessionToken]);

  const listPersonalExercises = useCallback(async (): Promise<readonly PersonalExercise[]> => {
    if (!sessionToken) {
      return [];
    }
    const response = await apiFetch("/api/personal-exercises", { sessionToken }).catch(() => null);
    if (!response?.ok) {
      return [];
    }
    const body = await response.json().catch(() => ({ exercises: [] }));
    return body.exercises ?? [];
  }, [sessionToken]);

  const saveObservation = useCallback(
    async (draft: ObservationDraft, matchId?: string): Promise<AuthResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour enregistrer cette observation." };
      }
      const response = await apiFetch("/api/observations", {
        method: "POST",
        sessionToken,
        body: JSON.stringify(matchId ? { ...draft, matchId } : draft),
      });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      return { ok: true };
    },
    [sessionToken],
  );

  const addPlayer = useCallback(
    async (firstName: string, lastName: string): Promise<AuthResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour ajouter un joueur." };
      }
      const response = await apiFetch("/api/roster", { method: "POST", sessionToken, body: JSON.stringify({ firstName, lastName }) });
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
    async (id: string, firstName: string, lastName: string): Promise<AuthResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour renommer un joueur." };
      }
      const response = await apiFetch(`/api/roster/${id}`, {
        method: "PATCH",
        sessionToken,
        body: JSON.stringify({ firstName, lastName }),
      });
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

  const listMatches = useCallback(async (): Promise<MatchListResult> => {
    if (!sessionToken) {
      return { ok: false, error: "Connecte-toi pour voir tes matchs." };
    }
    const response = await apiFetch("/api/matches", { sessionToken });
    if (!response.ok) {
      return { ok: false, error: await readErrorMessage(response) };
    }
    const body = await response.json();
    return { ok: true, matches: body.matches ?? [] };
  }, [sessionToken]);

  const getMatch = useCallback(
    async (id: string): Promise<MatchResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour voir ce match." };
      }
      const response = await apiFetch(`/api/matches/${id}`, { sessionToken });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      const body = await response.json();
      return { ok: true, match: body.match };
    },
    [sessionToken],
  );

  const createMatch = useCallback(
    async (input: { opponent: string; dateLabel: string; venue: MatchVenue; gameFormat: number; formationId?: string }): Promise<MatchResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour préparer un match." };
      }
      const response = await apiFetch("/api/matches", { method: "POST", sessionToken, body: JSON.stringify(input) });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      const body = await response.json();
      return { ok: true, match: body.match };
    },
    [sessionToken],
  );

  const updateMatchLineup = useCallback(
    async (id: string, lineup: MatchLineupAssignment[], captainPlayerId: string | null): Promise<MatchResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour modifier la composition." };
      }
      const response = await apiFetch(`/api/matches/${id}`, {
        method: "PUT",
        sessionToken,
        body: JSON.stringify({ lineup, captainPlayerId }),
      });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      const body = await response.json();
      return { ok: true, match: body.match };
    },
    [sessionToken],
  );

  const changeMatchFormation = useCallback(
    async (id: string, formationId: string): Promise<MatchResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour changer de formation." };
      }
      const response = await apiFetch(`/api/matches/${id}/formation`, {
        method: "PUT",
        sessionToken,
        body: JSON.stringify({ formationId }),
      });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      const body = await response.json();
      return { ok: true, match: body.match };
    },
    [sessionToken],
  );

  const markMatchPlayed = useCallback(
    async (id: string): Promise<MatchResult> => {
      if (!sessionToken) {
        return { ok: false, error: "Connecte-toi pour marquer ce match comme joué." };
      }
      const response = await apiFetch(`/api/matches/${id}/played`, { method: "POST", sessionToken });
      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response) };
      }
      const body = await response.json();
      return { ok: true, match: body.match };
    },
    [sessionToken],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      educator,
      restoring,
      team,
      diagnosticScores,
      roster,
      login,
      register,
      logout,
      deleteAccount,
      saveTeam,
      saveDiagnostic,
      saveTrainingSession,
      listSessions,
      loadSeason,
      listPersonalExercises,
      getPlayStyle,
      startNextCycle,
      saveObservation,
      listObservations,
      getObservation,
      getTeamStats,
      apiRequest,
      addPlayer,
      renamePlayer,
      removePlayer,
      listMatches,
      getMatch,
      createMatch,
      updateMatchLineup,
      changeMatchFormation,
      markMatchPlayed,
    }),
    [
      educator,
      restoring,
      team,
      diagnosticScores,
      roster,
      login,
      register,
      logout,
      deleteAccount,
      saveTeam,
      saveDiagnostic,
      saveTrainingSession,
      listSessions,
      loadSeason,
      listPersonalExercises,
      saveObservation,
      listObservations,
      getObservation,
      getTeamStats,
      apiRequest,
      addPlayer,
      renamePlayer,
      removePlayer,
      listMatches,
      getMatch,
      createMatch,
      updateMatchLineup,
      changeMatchFormation,
      markMatchPlayed,
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
