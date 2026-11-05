import type { AttendanceDefault, TrainingConvocationSettings } from "@evolyfoot/domain";
import type { PrismaClient } from "./generated/prisma/client";
import { TeamNotFoundError } from "./errors";

// Séance dont la convocation n'est pas encore partie, avec le réglage d'envoi de son équipe.
export interface AwaitingConvocation {
  educatorId: string;
  sessionId: string;
  meetingAt: Date;
  leadDays: number;
}

// Réglage des convocations aux entraînements (porté par l'équipe) et séances à convoquer
// automatiquement.
export interface TrainingConvocationRepository {
  findSettings(educatorId: string): Promise<TrainingConvocationSettings>;
  saveSettings(educatorId: string, settings: { leadDays: number | null; attendanceDefault: AttendanceDefault }): Promise<TrainingConvocationSettings>;
  listAwaiting(now: Date): Promise<AwaitingConvocation[]>;
}

export class PrismaTrainingConvocationRepository implements TrainingConvocationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findSettings(educatorId: string): Promise<TrainingConvocationSettings> {
    const team = await this.prisma.team.findUnique({ where: { educatorId }, select: { convocationLeadDays: true, attendanceDefault: true } });
    return { leadDays: team?.convocationLeadDays ?? null, attendanceDefault: team?.attendanceDefault ?? null };
  }

  async saveSettings(educatorId: string, settings: { leadDays: number | null; attendanceDefault: AttendanceDefault }): Promise<TrainingConvocationSettings> {
    const { count } = await this.prisma.team.updateMany({
      where: { educatorId },
      data: { convocationLeadDays: settings.leadDays, attendanceDefault: settings.attendanceDefault },
    });
    if (count === 0) {
      throw new TeamNotFoundError();
    }
    return { ...settings };
  }

  async listAwaiting(now: Date): Promise<AwaitingConvocation[]> {
    const records = await this.prisma.trainingSessionRecord.findMany({
      where: { convokedAt: null, meetingAt: { gt: now }, educator: { team: { convocationLeadDays: { not: null } } } },
      select: { id: true, educatorId: true, meetingAt: true, educator: { select: { team: { select: { convocationLeadDays: true } } } } },
    });
    return records.flatMap((record) => {
      const leadDays = record.educator.team?.convocationLeadDays;
      return record.meetingAt && leadDays !== null && leadDays !== undefined
        ? [{ educatorId: record.educatorId, sessionId: record.id, meetingAt: record.meetingAt, leadDays }]
        : [];
    });
  }
}
