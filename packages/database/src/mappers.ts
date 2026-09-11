import { defaultFormationId, sortTrainingDays } from "@evolyfoot/domain";
import type {
  AgeGroup as DomainAgeGroup,
  AttendanceEntry,
  DevelopmentTheme as DomainDevelopmentTheme,
  GameFormat,
  MatchLineupAssignment,
  MatchStatus as DomainMatchStatus,
  MatchVenue as DomainMatchVenue,
  ObservationEventType as DomainObservationEventType,
  ObservationReportRating,
  ObservationReportSummary,
  PlayerEvaluationScores,
  PlayerReference,
  PlayerSignal,
  TeamProfile,
  TrainingDay as DomainTrainingDay,
} from "@evolyfoot/domain";
import {
  AgeGroup as PrismaAgeGroup,
  DevelopmentTheme as PrismaDevelopmentTheme,
  MatchStatus as PrismaMatchStatus,
  MatchVenue as PrismaMatchVenue,
  ObservationEventType as PrismaObservationEventType,
  TrainingDay as PrismaTrainingDay,
} from "./generated/prisma/client";
import type {
  Diagnostic,
  Educator,
  EmailVerification as PrismaEmailVerification,
  MatchRecord as PrismaMatchRecord,
  ObservationRecord as PrismaObservationRecord,
  PlateauRecord as PrismaPlateauRecord,
  Player as PrismaPlayer,
  PlayerEvaluationRecord as PrismaPlayerEvaluationRecord,
  PlayerInvite as PrismaPlayerInvite,
  Session,
  Team,
  TournamentRecord as PrismaTournamentRecord,
  TrainingSessionRecord as PrismaTrainingSessionRecord,
} from "./generated/prisma/client";
import type {
  EducatorAuthRecord,
  EducatorProfile,
  EducatorRecord,
  EmailVerificationRecord,
  PlayerInviteRecord,
  PersistedDiagnostic,
  PersistedMatch,
  PersistedObservation,
  PersistedPlateau,
  PersistedPlayer,
  PersistedPlayerEvaluation,
  PersistedTeamProfile,
  PersistedTournament,
  PersistedTrainingSession,
  PersistedTrainingSessionBlock,
  SessionRecord,
} from "./repositories";

// `attendance` est un Json Prisma nullable : `null` (jamais saisi) devient `undefined` côté
// domaine, distingué d'un tableau vide (saisi mais personne de présent) -- voir le commentaire
// sur PersistedTrainingSession.attendance/PersistedMatch.attendance.
function toAttendanceEntries(value: unknown): readonly AttendanceEntry[] | undefined {
  return value === null || value === undefined ? undefined : (value as readonly AttendanceEntry[]);
}

function exhaustive(value: never): never {
  throw new Error(`Valeur d’énumération inconnue : ${String(value)}`);
}

export function toPrismaAgeGroup(ageGroup: DomainAgeGroup): PrismaAgeGroup {
  switch (ageGroup) {
    case "U10":
      return PrismaAgeGroup.U10;
    case "U11":
      return PrismaAgeGroup.U11;
    case "U12":
      return PrismaAgeGroup.U12;
    case "U13":
      return PrismaAgeGroup.U13;
    default:
      return exhaustive(ageGroup);
  }
}

export function fromPrismaAgeGroup(ageGroup: PrismaAgeGroup): DomainAgeGroup {
  switch (ageGroup) {
    case PrismaAgeGroup.U10:
      return "U10";
    case PrismaAgeGroup.U11:
      return "U11";
    case PrismaAgeGroup.U12:
      return "U12";
    case PrismaAgeGroup.U13:
      return "U13";
    default:
      return exhaustive(ageGroup);
  }
}

export function toPrismaTrainingDay(trainingDay: DomainTrainingDay): PrismaTrainingDay {
  switch (trainingDay) {
    case "Lundi":
      return PrismaTrainingDay.MONDAY;
    case "Mardi":
      return PrismaTrainingDay.TUESDAY;
    case "Mercredi":
      return PrismaTrainingDay.WEDNESDAY;
    case "Jeudi":
      return PrismaTrainingDay.THURSDAY;
    case "Vendredi":
      return PrismaTrainingDay.FRIDAY;
    default:
      return exhaustive(trainingDay);
  }
}

export function fromPrismaTrainingDay(trainingDay: PrismaTrainingDay): DomainTrainingDay {
  switch (trainingDay) {
    case PrismaTrainingDay.MONDAY:
      return "Lundi";
    case PrismaTrainingDay.TUESDAY:
      return "Mardi";
    case PrismaTrainingDay.WEDNESDAY:
      return "Mercredi";
    case PrismaTrainingDay.THURSDAY:
      return "Jeudi";
    case PrismaTrainingDay.FRIDAY:
      return "Vendredi";
    default:
      return exhaustive(trainingDay);
  }
}

export function toPrismaDevelopmentTheme(theme: DomainDevelopmentTheme): PrismaDevelopmentTheme {
  switch (theme) {
    case "Conserver le ballon":
      return PrismaDevelopmentTheme.KEEPING_BALL;
    case "Progresser ensemble":
      return PrismaDevelopmentTheme.PROGRESSING;
    case "Finir les actions":
      return PrismaDevelopmentTheme.FINISHING;
    case "Récupérer rapidement":
      return PrismaDevelopmentTheme.RECOVERING;
    default:
      return exhaustive(theme);
  }
}

export function fromPrismaDevelopmentTheme(theme: PrismaDevelopmentTheme): DomainDevelopmentTheme {
  switch (theme) {
    case PrismaDevelopmentTheme.KEEPING_BALL:
      return "Conserver le ballon";
    case PrismaDevelopmentTheme.PROGRESSING:
      return "Progresser ensemble";
    case PrismaDevelopmentTheme.FINISHING:
      return "Finir les actions";
    case PrismaDevelopmentTheme.RECOVERING:
      return "Récupérer rapidement";
    default:
      return exhaustive(theme);
  }
}

export function toPrismaObservationEventType(eventType: DomainObservationEventType): PrismaObservationEventType {
  switch (eventType) {
    case "training":
      return PrismaObservationEventType.training;
    case "match":
      return PrismaObservationEventType.match;
    default:
      return exhaustive(eventType);
  }
}

export function fromPrismaObservationEventType(eventType: PrismaObservationEventType): DomainObservationEventType {
  switch (eventType) {
    case PrismaObservationEventType.training:
      return "training";
    case PrismaObservationEventType.match:
      return "match";
    default:
      return exhaustive(eventType);
  }
}

export function toPrismaMatchVenue(venue: DomainMatchVenue): PrismaMatchVenue {
  switch (venue) {
    case "home":
      return PrismaMatchVenue.home;
    case "away":
      return PrismaMatchVenue.away;
    default:
      return exhaustive(venue);
  }
}

export function fromPrismaMatchVenue(venue: PrismaMatchVenue): DomainMatchVenue {
  switch (venue) {
    case PrismaMatchVenue.home:
      return "home";
    case PrismaMatchVenue.away:
      return "away";
    default:
      return exhaustive(venue);
  }
}

export function toPrismaMatchStatus(status: DomainMatchStatus): PrismaMatchStatus {
  switch (status) {
    case "scheduled":
      return PrismaMatchStatus.scheduled;
    case "played":
      return PrismaMatchStatus.played;
    default:
      return exhaustive(status);
  }
}

export function fromPrismaMatchStatus(status: PrismaMatchStatus): DomainMatchStatus {
  switch (status) {
    case PrismaMatchStatus.scheduled:
      return "scheduled";
    case PrismaMatchStatus.played:
      return "played";
    default:
      return exhaustive(status);
  }
}

export function toEducatorRecord(educator: Educator): EducatorRecord {
  return Object.freeze({
    id: educator.id,
    email: educator.email,
    displayName: educator.displayName,
    // `role` est un texte libre en base (voir schema.prisma) : on retombe sur "coach" pour toute
    // valeur inattendue, jamais "player" par erreur.
    role: educator.role === "player" ? "player" : "coach",
    linkedPlayerId: educator.linkedPlayerId,
    emailVerifiedAt: educator.emailVerifiedAt,
    createdAt: educator.createdAt,
    updatedAt: educator.updatedAt,
  });
}

export function toPlayerInviteRecord(invite: PrismaPlayerInvite): PlayerInviteRecord {
  return Object.freeze({
    id: invite.id,
    educatorId: invite.educatorId,
    playerId: invite.playerId,
    tokenHash: invite.tokenHash,
    expiresAt: invite.expiresAt,
    consumedAt: invite.consumedAt,
    createdAt: invite.createdAt,
  });
}

export function toEmailVerificationRecord(verification: PrismaEmailVerification): EmailVerificationRecord {
  return Object.freeze({
    id: verification.id,
    educatorId: verification.educatorId,
    tokenHash: verification.tokenHash,
    expiresAt: verification.expiresAt,
    consumedAt: verification.consumedAt,
    createdAt: verification.createdAt,
  });
}

export function toEducatorAuthRecord(educator: Educator): EducatorAuthRecord {
  return Object.freeze({
    ...toEducatorRecord(educator),
    passwordHash: educator.passwordHash,
  });
}

export function toEducatorProfile(educator: Educator): EducatorProfile {
  return Object.freeze({
    id: educator.id,
    email: educator.email,
    displayName: educator.displayName,
    birthDate: educator.birthDate,
    club: educator.club,
    country: educator.country,
    address: educator.address,
    phone: educator.phone,
    diploma: educator.diploma,
    seasonFormat: educator.seasonFormat,
    createdAt: educator.createdAt,
  });
}

export function toSessionRecord(session: Session): SessionRecord {
  return Object.freeze({
    id: session.id,
    educatorId: session.educatorId,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
  });
}

export function toPersistedDiagnostic(diagnostic: Diagnostic): PersistedDiagnostic {
  return Object.freeze({
    id: diagnostic.id,
    educatorId: diagnostic.educatorId,
    scores: Object.freeze({
      availability: diagnostic.availability,
      scanning: diagnostic.scanning,
      progression: diagnostic.progression,
      reactionAfterLoss: diagnostic.reactionAfterLoss,
    }),
    createdAt: diagnostic.createdAt,
    updatedAt: diagnostic.updatedAt,
  });
}

export function toPersistedTrainingSession(record: PrismaTrainingSessionRecord): PersistedTrainingSession {
  return Object.freeze({
    id: record.id,
    educatorId: record.educatorId,
    title: record.title,
    ageGroup: fromPrismaAgeGroup(record.ageGroup),
    playerCount: record.playerCount,
    theme: fromPrismaDevelopmentTheme(record.theme),
    intention: record.intention,
    // `blocks` est un Json Prisma : on fait confiance à sa forme puisque seul ce paquet
    // l'écrit (voir TrainingSessionService.create, qui reconstruit et valide la séance avant
    // d'appeler ce dépôt).
    blocks: record.blocks as unknown as PersistedTrainingSessionBlock[],
    weekNumber: record.weekNumber,
    slot: record.slot,
    meetingAt: record.meetingAt,
    location: record.location,
    description: record.description,
    attendance: toAttendanceEntries(record.attendance),
    createdAt: record.createdAt,
  });
}

export function toPersistedObservation(record: PrismaObservationRecord): PersistedObservation {
  return Object.freeze({
    id: record.id,
    educatorId: record.educatorId,
    eventType: fromPrismaObservationEventType(record.eventType),
    title: record.title,
    dateLabel: record.dateLabel,
    players: record.players as unknown as readonly PlayerReference[],
    ratings: record.ratings as unknown as readonly ObservationReportRating[],
    signals: record.signals as unknown as readonly PlayerSignal[],
    ...(record.note !== null ? { note: record.note } : {}),
    summary: record.summary as unknown as ObservationReportSummary,
    ...(record.matchId !== null ? { matchId: record.matchId } : {}),
    createdAt: record.createdAt,
  });
}

export function toPersistedMatch(record: PrismaMatchRecord): PersistedMatch {
  const gameFormat = record.gameFormat as GameFormat;
  return Object.freeze({
    id: record.id,
    educatorId: record.educatorId,
    opponent: record.opponent,
    dateLabel: record.dateLabel,
    meetingTime: record.meetingTime,
    location: record.location,
    description: record.description,
    venue: fromPrismaMatchVenue(record.venue),
    // Un entier borné en base, pas un enum Postgres, même principe que `Team.gameFormat` : la
    // validation du domaine garantit qu'une valeur 4-11 est seule persistée ici.
    gameFormat,
    // Repli sur la formation par défaut du format de jeu si la colonne est vide (match préparé
    // avant l'introduction du choix multiple) -- voir le commentaire sur `PersistedMatch`.
    formationId: record.formationId ?? defaultFormationId(gameFormat),
    status: fromPrismaMatchStatus(record.status),
    lineup: record.lineup as unknown as readonly MatchLineupAssignment[],
    captainPlayerId: record.captainPlayerId,
    substitutePlayerIds: (record.substitutePlayerIds as unknown as readonly string[] | null) ?? [],
    attendance: toAttendanceEntries(record.attendance),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function toPersistedTournament(record: PrismaTournamentRecord): PersistedTournament {
  return Object.freeze({
    id: record.id,
    educatorId: record.educatorId,
    name: record.name,
    dateLabel: record.dateLabel,
    result: record.result,
    createdAt: record.createdAt,
  });
}

export function toPersistedPlateau(record: PrismaPlateauRecord): PersistedPlateau {
  return Object.freeze({
    id: record.id,
    educatorId: record.educatorId,
    name: record.name,
    dateLabel: record.dateLabel,
    result: record.result,
    createdAt: record.createdAt,
  });
}

export function toPersistedPlayerEvaluation(record: PrismaPlayerEvaluationRecord): PersistedPlayerEvaluation {
  return Object.freeze({
    id: record.id,
    educatorId: record.educatorId,
    playerId: record.playerId,
    // `scores` est un Json Prisma : on fait confiance à sa forme, seul ce paquet l'écrit (voir
    // PlayerEvaluationService.save, qui valide les scores avant d'appeler ce dépôt).
    scores: record.scores as unknown as PlayerEvaluationScores,
    createdAt: record.createdAt,
  });
}

export function toPersistedTeamProfile(team: Team): PersistedTeamProfile {
  const profile: TeamProfile = Object.freeze({
    name: team.name,
    ageGroup: fromPrismaAgeGroup(team.ageGroup),
    // Un entier borné en base (voir schema.prisma), pas un enum Postgres : la validation du
    // domaine (`gameFormats`, rejouée à chaque écriture par TeamProfileService) garantit déjà
    // que seule une valeur 4-11 a pu être persistée.
    gameFormat: team.gameFormat as GameFormat,
    playerCount: team.playerCount,
    sessionsPerWeek: team.sessionsPerWeek,
    // Trié dans l'ordre canonique de la semaine (voir sortTrainingDays côté domaine) : l'ordre
    // stocké en base est celui de la saisie, pas garanti chronologique (constaté : "Mercredi,
    // Vendredi, Mardi" pour une équipe créée avant ce tri), alors que la page Séances et le
    // calendrier hebdomadaire en dépendent pour numéroter les créneaux correctement.
    trainingDays: sortTrainingDays(team.trainingDays.map(fromPrismaTrainingDay)),
  });

  return Object.freeze({
    id: team.id,
    educatorId: team.educatorId,
    profile,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  });
}

export function toPersistedPlayer(player: PrismaPlayer): PersistedPlayer {
  return Object.freeze({
    id: player.id,
    educatorId: player.educatorId,
    name: player.name,
    photo: player.photo,
    birthDate: player.birthDate,
    phone: player.phone,
    email: player.email,
    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
  });
}
