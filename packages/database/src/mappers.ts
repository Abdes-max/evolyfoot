import type { AgeGroup as DomainAgeGroup, TeamProfile, TrainingDay as DomainTrainingDay } from "@evolyfoot/domain";
import { AgeGroup as PrismaAgeGroup, TrainingDay as PrismaTrainingDay } from "./generated/prisma/client";
import type { Educator, Team } from "./generated/prisma/client";
import type { EducatorRecord, PersistedTeamProfile } from "./repositories";

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

export function toEducatorRecord(educator: Educator): EducatorRecord {
  return Object.freeze({
    id: educator.id,
    email: educator.email,
    displayName: educator.displayName,
    createdAt: educator.createdAt,
    updatedAt: educator.updatedAt,
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
