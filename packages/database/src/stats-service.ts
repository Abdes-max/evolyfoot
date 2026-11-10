import { summarizeAttendance } from "@evolyfoot/domain";
import type { AttendanceEntry, AttendanceSummary } from "@evolyfoot/domain";
import type { MatchRepository, PlateauRepository, TournamentRepository, TrainingSessionRepository } from "./repositories";

export interface TeamStats {
  trainingCount: number;
  matchCount: number;
  matchesPlayed: number;
  matchesScheduled: number;
  tournamentCount: number;
  plateauCount: number;
  trainingAttendance: AttendanceSummary;
  matchAttendance: AttendanceSummary;
}

// Lit et agrège en mémoire (pas de SQL brut, contrairement à MetricsService qui a besoin de
// regrouper par semaine calendaire) : le volume par éducateur (ses propres séances/matchs/
// tournois/plateaux) reste petit, un simple `Array.filter`/`flatMap` suffit et reste lisible.
export class StatsService {
  constructor(
    private readonly trainingSessionRepository: TrainingSessionRepository,
    private readonly matchRepository: MatchRepository,
    private readonly tournamentRepository: TournamentRepository,
    private readonly plateauRepository: PlateauRepository,
  ) {}

  // Les événements annulés ne comptent ni dans les totaux ni dans les taux de présence : ils n'ont pas eu lieu.
  async get(educatorId: string): Promise<TeamStats> {
    const [allSessions, allMatches, allTournaments, allPlateaux] = await Promise.all([
      this.trainingSessionRepository.listByEducator(educatorId),
      this.matchRepository.listByEducator(educatorId),
      this.tournamentRepository.listByEducator(educatorId),
      this.plateauRepository.listByEducator(educatorId),
    ]);
    const sessions = allSessions.filter((session) => !session.cancelledAt);
    const matches = allMatches.filter((match) => !match.cancelledAt);
    const tournaments = allTournaments.filter((tournament) => !tournament.cancelledAt);
    const plateaux = allPlateaux.filter((plateau) => !plateau.cancelledAt);

    const trainingAttendanceEntries: AttendanceEntry[] = sessions.flatMap((session) => [...(session.attendance ?? [])]);
    const matchAttendanceEntries: AttendanceEntry[] = matches.flatMap((match) => [...(match.attendance ?? [])]);

    return {
      trainingCount: sessions.length,
      matchCount: matches.length,
      matchesPlayed: matches.filter((match) => match.status === "played").length,
      matchesScheduled: matches.filter((match) => match.status === "scheduled").length,
      tournamentCount: tournaments.length,
      plateauCount: plateaux.length,
      trainingAttendance: summarizeAttendance(trainingAttendanceEntries),
      matchAttendance: summarizeAttendance(matchAttendanceEntries),
    };
  }
}
