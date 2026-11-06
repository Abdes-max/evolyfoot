import {
  buildPrioritizedSeason,
  guidedSeasonCycle,
  nextSeasonSlot,
  seasonCycleAt,
  seasonCycles,
  seasonWeekAt,
  type DevelopmentTheme,
  type SavedTrainingSession,
  type SeasonCycle,
  type SeasonWeek,
} from "@evolyfoot/domain";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "./auth-context";

export interface SeasonCycleState {
  // `null` : pas de saison guidée, l'appli reste sur le cycle court tiré du diagnostic.
  program: { priorities: DevelopmentTheme[]; startDate: string } | null;
  loaded: boolean;
  seasonWeeks: readonly SeasonWeek[];
  cycles: readonly SeasonCycle[];
  currentSeasonWeek: number;
  currentCycle: SeasonCycle | null;
  // Séances de la saison guidée déjà préparées.
  prepared: readonly SavedTrainingSession[];
  nextGuided: ReturnType<typeof nextSeasonSlot>;
}

// Saison guidée lue en cycles de 4 semaines (même logique que le web, voir seasonCycles), relue à
// chaque retour sur l'écran.
export function useSeasonCycle(): SeasonCycleState {
  const { apiRequest, team } = useAuth();
  const [program, setProgram] = useState<SeasonCycleState["program"]>(null);
  const [prepared, setPrepared] = useState<readonly SavedTrainingSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const [programResponse, sessionsResponse] = await Promise.all([apiRequest("/api/season-program"), apiRequest("/api/sessions?scope=season")]);
        const programBody = programResponse?.ok ? await programResponse.json().catch(() => null) : null;
        const sessionsBody = sessionsResponse?.ok ? await sessionsResponse.json().catch(() => null) : null;
        if (cancelled) return;
        setProgram(programBody?.program ?? null);
        setPrepared(((sessionsBody?.sessions ?? []) as SavedTrainingSession[]).filter((session) => session.cycleNumber === guidedSeasonCycle));
        setLoaded(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [apiRequest]),
  );

  const sessionsPerWeek = team?.sessionsPerWeek ?? 2;
  return useMemo(() => {
    const seasonWeeks = program ? buildPrioritizedSeason({ priorities: program.priorities, sessionsPerWeek }) : [];
    const cycles = seasonCycles(seasonWeeks);
    const currentSeasonWeek = program ? seasonWeekAt(new Date(`${program.startDate}T00:00:00`), now) : 0;
    return {
      program,
      loaded,
      seasonWeeks,
      cycles,
      currentSeasonWeek,
      currentCycle: program ? seasonCycleAt(cycles, currentSeasonWeek) : null,
      prepared,
      nextGuided: program ? nextSeasonSlot(seasonWeeks, prepared, currentSeasonWeek) : null,
    };
  }, [program, loaded, prepared, sessionsPerWeek, now]);
}

// Ouvre une séance de la saison : préparée (mode terrain) ou à préparer (sa fiche du programme).
export function openSeasonSlot(sessionNumber: number, seasonWeek: number, index: number, preparedId?: string) {
  if (preparedId) {
    router.push(`/terrain/${preparedId}`);
  } else {
    router.push({ pathname: "/saison/seance/[number]", params: { number: String(sessionNumber), semaine: String(seasonWeek), creneau: String(index) } });
  }
}
