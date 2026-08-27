import { Prisma } from "./generated/prisma/client";
import type { PrismaClient } from "./generated/prisma/client";
import { DuplicateEducatorEmailError, EducatorNotFoundError, TeamNotFoundError } from "./errors";
import {
  toEducatorAuthRecord,
  toEducatorRecord,
  toPersistedTeamProfile,
  toPrismaAgeGroup,
  toPrismaTrainingDay,
  toSessionRecord,
} from "./mappers";
import { normalizeEducatorEmail } from "./email";
import type {
  EducatorAuthRecord,
  EducatorRecord,
  EducatorRepository,
  PersistedTeamProfile,
  SessionRecord,
  SessionRepository,
  TeamRepository,
} from "./repositories";
import type { TeamProfile } from "@evolyfoot/domain";

function translateEducatorWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        throw new DuplicateEducatorEmailError();
      case "P2025":
        throw new EducatorNotFoundError();
      default:
        throw error;
    }
  }

  throw error;
}

function translateTeamWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2003":
        throw new EducatorNotFoundError();
      case "P2025":
        throw new TeamNotFoundError();
      default:
        throw error;
    }
  }

  throw error;
}

export class PrismaEducatorRepository implements EducatorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: { email: string; displayName: string; passwordHash: string }): Promise<EducatorRecord> {
    try {
      const educator = await this.prisma.educator.create({
        data: {
          email: normalizeEducatorEmail(input.email),
          displayName: input.displayName,
          passwordHash: input.passwordHash,
        },
      });
      return toEducatorRecord(educator);
    } catch (error) {
      return translateEducatorWriteError(error);
    }
  }

  async existsById(id: string): Promise<boolean> {
    const educator = await this.prisma.educator.findUnique({
      where: { id },
      select: { id: true },
    });
    return educator !== null;
  }

  async findById(id: string): Promise<EducatorRecord | null> {
    const educator = await this.prisma.educator.findUnique({ where: { id } });
    return educator === null ? null : toEducatorRecord(educator);
  }

  async findByEmail(email: string): Promise<EducatorAuthRecord | null> {
    const educator = await this.prisma.educator.findUnique({
      where: { email: normalizeEducatorEmail(email) },
    });
    return educator === null ? null : toEducatorAuthRecord(educator);
  }
}

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: { educatorId: string; tokenHash: string; expiresAt: Date }): Promise<SessionRecord> {
    const session = await this.prisma.session.create({
      data: {
        educatorId: input.educatorId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
    return toSessionRecord(session);
  }

  async findValidByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const session = await this.prisma.session.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
    });
    return session === null ? null : toSessionRecord(session);
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }
}

export class PrismaTeamRepository implements TeamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertForEducator(educatorId: string, profile: TeamProfile): Promise<PersistedTeamProfile> {
    try {
      const team = await this.prisma.team.upsert({
        where: { educatorId },
        create: {
          educatorId,
          name: profile.name,
          ageGroup: toPrismaAgeGroup(profile.ageGroup),
          playerCount: profile.playerCount,
          sessionsPerWeek: profile.sessionsPerWeek,
          trainingDays: profile.trainingDays.map(toPrismaTrainingDay),
        },
        update: {
          name: profile.name,
          ageGroup: toPrismaAgeGroup(profile.ageGroup),
          playerCount: profile.playerCount,
          sessionsPerWeek: profile.sessionsPerWeek,
          trainingDays: profile.trainingDays.map(toPrismaTrainingDay),
        },
      });
      return toPersistedTeamProfile(team);
    } catch (error) {
      return translateTeamWriteError(error);
    }
  }

  async findForEducator(educatorId: string): Promise<PersistedTeamProfile | null> {
    const team = await this.prisma.team.findUnique({ where: { educatorId } });
    return team === null ? null : toPersistedTeamProfile(team);
  }
}
