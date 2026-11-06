import { attendanceStatusOf, isConcerned, playerSeasonTotals, summarizeAttendance } from "@evolyfoot/domain";
import type { AttendanceEntry, AttendanceStatus, AttendanceSummary, PlayerEvaluationScores, PlayerSeasonTotals, TrainingDay } from "@evolyfoot/domain";
import { EducatorNotFoundError } from "./errors";
import { matchKickoffTime, matchMeetingTime } from "./match-time";
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
import type { TrainingConvocationRepository } from "./training-convocation-repository";

export interface PlayerDashboardEvaluation {
  id: string;
  scores: PlayerEvaluationScores;
  source: "coach" | "player";
  createdAt: Date;
}

export interface PlayerDashboardMatch {
  id: string;
  opponent: string;
  dateLabel: string;
  // Vraie date calendaire (voir le commentaire dans schema.prisma côté base) -- `null` pour un
  // match créé avant l'introduction de ce champ, alors exclu du tri chronologique unifié
  // séances/matchs/compétitions (voir calendar-view.tsx), affiché en repli avec `dateLabel` seul.
  date: Date | null;
  // Heure du coup d'envoi (dérivée de `date`, voir matchKickoffTime côté base) -- distincte de
  // `meetingTime`, le rendez-vous avant le match.
  kickoffTime: string | null;
  meetingTime: string | null;
  location: string | null;
  description: string | null;
  venue: "home" | "away";
  convoked: boolean;
  // Réponse déjà enregistrée par le joueur/tuteur à sa convocation (voir PlayerRsvpService),
  // `null` s'il n'a pas encore répondu.
  myStatus: AttendanceStatus | null;
}

// Créneau du cycle occupé par une séance déjà générée -- juste de quoi savoir, jour par jour de
// la semaine, si une séance existe (voir apps/web/weekly-calendar.tsx, dont le calcul de grille
// est réutilisé côté joueur avec ces mêmes weekNumber/slot). Toujours présent même sans rendez-vous
// (voir PlayerDashboardTrainingSession ci-dessous pour la fiche détaillée, cliquable elle).
export interface PlayerDashboardTrainingSlot {
  weekNumber: number;
  slot: number;
}

// Séance à laquelle répondre présent/absent, même principe que PlayerDashboardMatch -- mais
// toujours "convoquée" : à la différence d'un match, il n'y a pas de composition/effectif retenu
// pour une séance, toute l'équipe y est attendue par défaut.
export interface PlayerDashboardTrainingSession {
  id: string;
  title: string;
  dateLabel: string;
  date: Date | null;
  meetingTime: string | null;
  location: string | null;
  description: string | null;
  myStatus: AttendanceStatus | null;
  myStatusByDefault: boolean;
  // Convocation envoyée : avant, la séance est seulement « programmée », sans réponse possible.
  convoked: boolean;
}

// Plateau ou tournoi -- fusionnés sous "compétition", seule distinction utile pour le joueur.
// Réponse possible une fois la convocation envoyée, comme une séance.
export interface PlayerDashboardCompetition {
  id: string;
  type: "plateau" | "tournoi";
  name: string;
  dateLabel: string;
  date: Date | null;
  location: string | null;
  description: string | null;
  convoked: boolean;
  myStatus: AttendanceStatus | null;
}

export interface PlayerDashboard {
  player: {
    id: string;
    name: string;
    photo: string | null;
    position: string | null;
    jerseyNumber: string | null;
    preferredFoot: string | null;
  };
  season: PlayerSeasonTotals;
  team: { name: string; ageGroup: string; trainingDays: readonly TrainingDay[] } | null;
  evaluations: PlayerDashboardEvaluation[];
  trainingAttendance: AttendanceSummary;
  matchAttendance: AttendanceSummary;
  upcomingMatches: PlayerDashboardMatch[];
  // Matchs déjà joués : le calendrier du joueur les montre dans « Passés ».
  pastMatches: PlayerDashboardMatch[];
  trainingSlots: PlayerDashboardTrainingSlot[];
  trainingSessions: PlayerDashboardTrainingSession[];
  competitions: PlayerDashboardCompetition[];
}

// Fuseau du club plutôt que celui (souvent UTC) du serveur qui exécute ce code -- voir le même
// correctif dans match-time.ts.
const clubTimeZone = "Europe/Paris";

// "Samedi 19 septembre" -- ou, à défaut de rendez-vous (séance créée avant que ce champ ne soit
// obligatoire), un repère générique sur le cycle ("Semaine 1 · créneau 1"), seule date dont elle
// dispose alors.
function trainingSessionDateLabel(meetingAt: Date | null, weekNumber: number, slot: number): string {
  if (meetingAt) {
    return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: clubTimeZone })
      .format(meetingAt)
      .replace(/^\p{L}/u, (letter) => letter.toUpperCase());
  }
  return `Semaine ${weekNumber} · créneau ${slot + 1}`;
}

function trainingSessionMeetingTime(meetingAt: Date | null): string | null {
  return meetingAt ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: clubTimeZone }).format(meetingAt) : null;
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
    // Joueurs des entraînements ; absent, toute l'équipe voit les séances.
    private readonly convocationRepository?: Pick<TrainingConvocationRepository, "findSettings">,
  ) {}

  private async resolveOwnedPlayer(playerAccountId: string) {
    const account = await this.educatorRepository.findById(playerAccountId);
    if (!account || account.role !== "player" || !account.linkedPlayerId) {
      throw new EducatorNotFoundError();
    }
    const owned = await this.playerRepository.findAnyById(account.linkedPlayerId);
    if (!owned) {
      throw new EducatorNotFoundError();
    }
    return owned;
  }

  async get(playerAccountId: string): Promise<PlayerDashboard> {
    const owned = await this.resolveOwnedPlayer(playerAccountId);
    const playerId = owned.id;
    const ownerId = owned.educatorId;

    const [team, allSessions, currentCycle, allMatches, evaluations, allPlateaux, allTournaments, settings] = await Promise.all([
      this.teamRepository.findForEducator(ownerId),
      this.trainingSessionRepository.listByEducator(ownerId),
      this.trainingSessionRepository.currentCycle(ownerId),
      this.matchRepository.listByEducator(ownerId),
      this.playerEvaluationRepository.listByPlayer(playerId, ownerId),
      this.plateauRepository.listByEducator(ownerId),
      this.tournamentRepository.listByEducator(ownerId),
      this.convocationRepository?.findSettings(ownerId),
    ]);
    // Un joueur ne voit que les événements qui le concernent (voir concerned-players.ts côté domaine).
    const sessions = isConcerned(settings?.playerIds, playerId) ? allSessions : [];
    const matches = allMatches.filter((match) => isConcerned(match.selectedPlayerIds, playerId));
    const plateaux = allPlateaux.filter((plateau) => isConcerned(plateau.selectedPlayerIds, playerId));
    const tournaments = allTournaments.filter((tournament) => isConcerned(tournament.selectedPlayerIds, playerId));
    const competitionFields = (competition: (typeof plateaux)[number]) => {
      const myEntry = competition.attendance?.find((entry) => entry.playerId === playerId);
      return {
        id: competition.id,
        name: competition.name,
        dateLabel: competition.dateLabel,
        date: competition.date,
        location: competition.location,
        description: competition.description,
        convoked: competition.convokedAt !== null,
        myStatus: myEntry ? attendanceStatusOf(myEntry) : null,
      };
    };

    const trainingEntries: AttendanceEntry[] = sessions.flatMap((session) => (session.attendance ?? []).filter((entry) => entry.playerId === playerId));
    const matchEntries: AttendanceEntry[] = matches.flatMap((match) => (match.attendance ?? []).filter((entry) => entry.playerId === playerId));

    const toDashboardMatch = (match: (typeof matches)[number]): PlayerDashboardMatch => {
      const myEntry = match.attendance?.find((entry) => entry.playerId === playerId);
      return {
        id: match.id,
        opponent: match.opponent,
        dateLabel: match.dateLabel,
        date: match.date,
        kickoffTime: matchKickoffTime(match.date),
        meetingTime: matchMeetingTime(match.date, match.meetingOffsetMinutes, match.meetingTime),
        location: match.location,
        description: match.description,
        venue: match.venue,
        convoked: true,
        myStatus: myEntry ? attendanceStatusOf(myEntry) : null,
      };
    };
    const upcomingMatches = matches.filter((match) => match.status === "scheduled").map(toDashboardMatch);
    const pastMatches = matches.filter((match) => match.status === "played").map(toDashboardMatch);

    return {
      player: {
        id: owned.id,
        name: owned.name,
        photo: owned.photo,
        position: owned.position,
        jerseyNumber: owned.jerseyNumber,
        preferredFoot: owned.preferredFoot,
      },
      // Totaux sur tous les matchs : un joueur retiré d'un match n'y a de toute façon pas de statistiques.
      season: playerSeasonTotals(allMatches, playerId),
      team: team ? { name: team.profile.name, ageGroup: team.profile.ageGroup, trainingDays: team.profile.trainingDays } : null,
      evaluations: evaluations.map((evaluation) => ({
        id: evaluation.id,
        scores: evaluation.scores,
        source: evaluation.source,
        createdAt: evaluation.createdAt,
      })),
      trainingAttendance: summarizeAttendance(trainingEntries),
      matchAttendance: summarizeAttendance(matchEntries),
      upcomingMatches,
      pastMatches,
      trainingSlots: sessions
        .filter((session) => session.cycleNumber === currentCycle)
        .map((session) => ({ weekNumber: session.weekNumber, slot: session.slot })),
      trainingSessions: sessions.map((session) => {
        const myEntry = session.attendance?.find((entry) => entry.playerId === playerId);
        return {
          id: session.id,
          title: session.title,
          dateLabel: trainingSessionDateLabel(session.meetingAt, session.weekNumber, session.slot),
          date: session.meetingAt,
          meetingTime: trainingSessionMeetingTime(session.meetingAt),
          location: session.location,
          description: session.description,
          myStatus: myEntry ? attendanceStatusOf(myEntry) : null,
          // Présence posée par défaut à la convocation, pas encore confirmée par le joueur.
          myStatusByDefault: myEntry?.byDefault === true,
          convoked: session.convokedAt !== null,
        };
      }),
      competitions: [
        ...plateaux.map((plateau) => ({ ...competitionFields(plateau), type: "plateau" as const })),
        ...tournaments.map((tournament) => ({ ...competitionFields(tournament), type: "tournoi" as const })),
      ],
    };
  }
}
