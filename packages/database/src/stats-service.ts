import { summarizeAttendance } from "@evolyfoot/domain";
import type { AttendanceEntry, AttendanceSummary } from "@evolyfoot/domain";
import type { MatchRepository, TournamentRepository, TrainingSessionRepository } from "./repositories";

export interface TeamStats {
  trainingCount: number;
  matchCount: number;
  matchesPlayed: number;
  matchesScheduled: number;
  tournamentCount: number;
  trainingAttendance: AttendanceSummary;
  matchAttendance: AttendanceSummary;
}

// Lit et agrège en mémoire (pas de SQL brut, contrairement à MetricsService qui a besoin de
// regrouper par semaine calendaire) : le volume par éducateur (ses propres séances/matchs/
// tournois) reste petit, un simple `Array.filter`/`flatMap` suffit et reste lisible.
export class StatsService {
  constructor(
    private readonly trainingSessionRepository: TrainingSessionRepository,
    private readonly matchRepository: MatchRepository,
    private readonly tournamentRepository: TournamentRepository,
  ) {}

  async get(educatorId: string): Promise<TeamStats> {
    const [sessions, matches, tournaments] = await Promise.all([
      this.trainingSessionRepository.listByEducator(educatorId),
      this.matchRepository.listByEducator(educatorId),
      this.tournamentRepository.listByEducator(educatorId),
    ]);

    const trainingAttendanceEntries: AttendanceEntry[] = sessions.flatMap((session) => [...(session.attendance ?? [])]);
    const matchAttendanceEntries: AttendanceEntry[] = matches.flatMap((match) => [...(match.attendance ?? [])]);

    return {
      trainingCount: sessions.length,
      matchCount: matches.length,
      matchesPlayed: matches.filter((match) => match.status === "played").length,
      matchesScheduled: matches.filter((match) => match.status === "scheduled").length,
      tournamentCount: tournaments.length,
      trainingAttendance: summarizeAttendance(trainingAttendanceEntries),
      matchAttendance: summarizeAttendance(matchAttendanceEntries),
    };
  }
}
