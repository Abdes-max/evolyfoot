import { summarizeAttendance } from "@evolyfoot/domain";
import type { AttendanceEntry, AttendanceSummary, PlayerEvaluationScores, TrainingDay } from "@evolyfoot/domain";
import { EducatorNotFoundError } from "./errors";
import type {
  EducatorRepository,
  MatchRepository,
  PlayerEvaluationRepository,
  PlayerRepository,
  TeamRepository,
  TrainingSessionRepository,
} from "./repositories";

export interface PlayerDashboardEvaluation {
  id: string;
  scores: PlayerEvaluationScores;
  createdAt: Date;
}

export interface PlayerDashboardMatch {
  id: string;
  opponent: string;
  dateLabel: string;
  venue: "home" | "away";
  convoked: boolean;
}

export interface PlayerDashboard {
  player: { id: string; name: string; photo: string | null };
  team: { name: string; ageGroup: string; trainingDays: readonly TrainingDay[] } | null;
  evaluations: PlayerDashboardEvaluation[];
  trainingAttendance: AttendanceSummary;
  matchAttendance: AttendanceSummary;
  upcomingMatches: PlayerDashboardMatch[];
}

// Toutes les données sont lues via l'éducateur PROPRIÉTAIRE du joueur (`Player.educatorId`),
// jamais via le compte joueur lui-même -- qui n'a ni équipe, ni séances, ni matchs.
export class PlayerDashboardService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly teamRepository: TeamRepository,
    private readonly trainingSessionRepository: TrainingSessionRepository,
    private readonly matchRepository: MatchRepository,
    private readonly playerEvaluationRepository: PlayerEvaluationRepository,
  ) {}

  async get(playerAccountId: string): Promise<PlayerDashboard> {
    const account = await this.educatorRepository.findById(playerAccountId);
    if (!account || account.role !== "player" || !account.linkedPlayerId) {
      throw new EducatorNotFoundError();
    }
    const playerId = account.linkedPlayerId;
    const owned = await this.playerRepository.findAnyById(playerId);
    if (!owned) {
      throw new EducatorNotFoundError();
    }
    const ownerId = owned.educatorId;

    const [team, sessions, matches, evaluations] = await Promise.all([
      this.teamRepository.findForEducator(ownerId),
      this.trainingSessionRepository.listByEducator(ownerId),
      this.matchRepository.listByEducator(ownerId),
      this.playerEvaluationRepository.listByPlayer(playerId, ownerId),
    ]);

    const trainingEntries: AttendanceEntry[] = sessions.flatMap((session) =>
      (session.attendance ?? []).filter((entry) => entry.playerId === playerId),
    );
    const matchEntries: AttendanceEntry[] = matches.flatMap((match) =>
      (match.attendance ?? []).filter((entry) => entry.playerId === playerId),
    );

    const upcomingMatches: PlayerDashboardMatch[] = matches
      .filter((match) => match.status === "scheduled")
      .map((match) => ({
        id: match.id,
        opponent: match.opponent,
        dateLabel: match.dateLabel,
        venue: match.venue,
        convoked: match.lineup.some((assignment) => assignment.playerId === playerId),
      }));

    return {
      player: { id: owned.id, name: owned.name, photo: owned.photo },
      team: team ? { name: team.profile.name, ageGroup: team.profile.ageGroup, trainingDays: team.profile.trainingDays } : null,
      evaluations: evaluations.map((evaluation) => ({
        id: evaluation.id,
        scores: evaluation.scores,
        createdAt: evaluation.createdAt,
      })),
      trainingAttendance: summarizeAttendance(trainingEntries),
      matchAttendance: summarizeAttendance(matchEntries),
      upcomingMatches,
    };
  }
}
