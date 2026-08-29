import type {
  AgeGroup as DomainAgeGroup,
  DevelopmentTheme as DomainDevelopmentTheme,
  ObservationEventType as DomainObservationEventType,
  ObservationReportRating,
  ObservationReportSummary,
  PlayerReference,
  PlayerSignal,
  TeamProfile,
  TrainingDay as DomainTrainingDay,
} from "@evolyfoot/domain";
import {
  AgeGroup as PrismaAgeGroup,
  DevelopmentTheme as PrismaDevelopmentTheme,
  ObservationEventType as PrismaObservationEventType,
  TrainingDay as PrismaTrainingDay,
} from "./generated/prisma/client";
import type {
  Diagnostic,
  Educator,
  ObservationRecord as PrismaObservationRecord,
  Session,
  Team,
  TrainingSessionRecord as PrismaTrainingSessionRecord,
} from "./generated/prisma/client";
import type {
  EducatorAuthRecord,
  EducatorRecord,
  PersistedDiagnostic,
  PersistedObservation,
  PersistedTeamProfile,
  PersistedTrainingSession,
  PersistedTrainingSessionBlock,
  SessionRecord,
} from "./repositories";

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

export function toEducatorRecord(educator: Educator): EducatorRecord {
  return Object.freeze({
    id: educator.id,
    email: educator.email,
    displayName: educator.displayName,
    createdAt: educator.createdAt,
    updatedAt: educator.updatedAt,
  });
}

export function toEducatorAuthRecord(educator: Educator): EducatorAuthRecord {
  return Object.freeze({
    ...toEducatorRecord(educator),
    passwordHash: educator.passwordHash,
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
    createdAt: record.createdAt,
  });
}

export function toPersistedTeamProfile(team: Team): PersistedTeamProfile {
  const profile: TeamProfile = Object.freeze({
    name: team.name,
    ageGroup: fromPrismaAgeGroup(team.ageGroup),
    playerCount: team.playerCount,
    sessionsPerWeek: team.sessionsPerWeek,
    trainingDays: team.trainingDays.map(fromPrismaTrainingDay),
  });

  return Object.freeze({
    id: team.id,
    educatorId: team.educatorId,
    profile,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  });
}
