import { attendanceStatusOf, summarizeAttendance } from "@evolyfoot/domain";
import type { AttendanceEntry, AttendanceStatus, AttendanceSummary, PlayerEvaluationScores, TrainingDay } from "@evolyfoot/domain";
import { EducatorNotFoundError } from "./errors";
import type {
  EducatorRepository,
  MatchRepository,
  PlateauRepository,
  PlayerEvaluationRepository,
  PlayerRepository,
  TeamRepository,
  TournamentRepository,
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
  // Réponse déjà enregistrée par le joueur/tuteur à sa convocation (voir PlayerRsvpService),
  // `null` s'il n'a pas encore répondu.
  myStatus: AttendanceStatus | null;
}

// Créneau du cycle occupé par une séance déjà générée -- juste de quoi savoir, jour par jour de
// la semaine, si une séance existe (voir apps/web/weekly-calendar.tsx, dont le calcul de grille
// est réutilisé côté joueur avec ces mêmes weekNumber/slot ; le joueur n'a en revanche aucun accès
// à la séance elle-même, contrairement au coach).
export interface PlayerDashboardTrainingSlot {
  weekNumber: number;
  slot: number;
}

// Plateau ou tournoi -- fusionnés sous "compétition", seule distinction utile pour le joueur.
export interface PlayerDashboardCompetition {
  id: string;
  type: "plateau" | "tournoi";
  name: string;
  dateLabel: string;
}

export interface PlayerDashboard {
  player: { id: string; name: string; photo: string | null };
  team: { name: string; ageGroup: string; trainingDays: readonly TrainingDay[] } | null;
  evaluations: PlayerDashboardEvaluation[];
  trainingAttendance: AttendanceSummary;
  matchAttendance: AttendanceSummary;
  upcomingMatches: PlayerDashboardMatch[];
  trainingSlots: PlayerDashboardTrainingSlot[];
  competitions: PlayerDashboardCompetition[];
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
    private readonly plateauRepository: PlateauRepository,
    private readonly tournamentRepository: TournamentRepository,
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

    const [team, sessions, matches, evaluations, plateaux, tournaments] = await Promise.all([
      this.teamRepository.findForEducator(ownerId),
      this.trainingSessionRepository.listByEducator(ownerId),
      this.matchRepository.listByEducator(ownerId),
      this.playerEvaluationRepository.listByPlayer(playerId, ownerId),
      this.plateauRepository.listByEducator(ownerId),
      this.tournamentRepository.listByEducator(ownerId),
    ]);

    const trainingEntries: AttendanceEntry[] = sessions.flatMap((session) =>
      (session.attendance ?? []).filter((entry) => entry.playerId === playerId),
    );
    const matchEntries: AttendanceEntry[] = matches.flatMap((match) =>
      (match.attendance ?? []).filter((entry) => entry.playerId === playerId),
    );

    const upcomingMatches: PlayerDashboardMatch[] = matches
      .filter((match) => match.status === "scheduled")
      .map((match) => {
        const myEntry = match.attendance?.find((entry) => entry.playerId === playerId);
        return {
          id: match.id,
          opponent: match.opponent,
          dateLabel: match.dateLabel,
          venue: match.venue,
          convoked: match.lineup.some((assignment) => assignment.playerId === playerId),
          myStatus: myEntry ? attendanceStatusOf(myEntry) : null,
        };
      });

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
      trainingSlots: sessions.map((session) => ({ weekNumber: session.weekNumber, slot: session.slot })),
      competitions: [
        ...plateaux.map((plateau) => ({ id: plateau.id, type: "plateau" as const, name: plateau.name, dateLabel: plateau.dateLabel })),
        ...tournaments.map((tournament) => ({
          id: tournament.id,
          type: "tournoi" as const,
          name: tournament.name,
          dateLabel: tournament.dateLabel,
        })),
      ],
    };
  }
}
