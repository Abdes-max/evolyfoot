import { Prisma } from "./generated/prisma/client";
import type { PrismaClient } from "./generated/prisma/client";
import {
  DiagnosticNotFoundError,
  DuplicateEducatorEmailError,
  EducatorNotFoundError,
  PlayerNotFoundError,
  TeamNotFoundError,
} from "./errors";
import {
  toEducatorAuthRecord,
  toEducatorRecord,
  toPersistedDiagnostic,
  toPersistedObservation,
  toPersistedPlayer,
  toPersistedTeamProfile,
  toPersistedTrainingSession,
  toPrismaAgeGroup,
  toPrismaDevelopmentTheme,
  toPrismaObservationEventType,
  toPrismaTrainingDay,
  toSessionRecord,
} from "./mappers";
import { normalizeEducatorEmail } from "./email";
import type {
  DiagnosticRepository,
  EducatorAuthRecord,
  EducatorRecord,
  EducatorRepository,
  ObservationRepository,
  PersistedDiagnostic,
  PersistedObservation,
  PersistedPlayer,
  PersistedTeamProfile,
  PersistedTrainingSession,
  PersistedTrainingSessionBlock,
  PlayerRepository,
  SessionRecord,
  SessionRepository,
  TeamRepository,
  TrainingSessionRepository,
} from "./repositories";
import type { AgeGroup, DevelopmentTheme, DiagnosticScores, ObservationReport, TeamProfile } from "@evolyfoot/domain";

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

function translateDiagnosticWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2003":
        throw new EducatorNotFoundError();
      case "P2025":
        throw new DiagnosticNotFoundError();
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

export class PrismaDiagnosticRepository implements DiagnosticRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertForEducator(educatorId: string, scores: DiagnosticScores): Promise<PersistedDiagnostic> {
    try {
      const diagnostic = await this.prisma.diagnostic.upsert({
        where: { educatorId },
        create: { educatorId, ...scores },
        update: { ...scores },
      });
      return toPersistedDiagnostic(diagnostic);
    } catch (error) {
      return translateDiagnosticWriteError(error);
    }
  }

  async findForEducator(educatorId: string): Promise<PersistedDiagnostic | null> {
    const diagnostic = await this.prisma.diagnostic.findUnique({ where: { educatorId } });
    return diagnostic === null ? null : toPersistedDiagnostic(diagnostic);
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
          gameFormat: profile.gameFormat,
          playerCount: profile.playerCount,
          sessionsPerWeek: profile.sessionsPerWeek,
          trainingDays: profile.trainingDays.map(toPrismaTrainingDay),
        },
        update: {
          name: profile.name,
          ageGroup: toPrismaAgeGroup(profile.ageGroup),
          gameFormat: profile.gameFormat,
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

// `create` ne peut échouer côté contrainte que sur la clé étrangère (P2003) : ni conflit
// d'unicité (aucune colonne unique hors la clé primaire générée) ni "non trouvé" (pas
// d'update/delete) ne s'appliquent à un simple ajout à l'historique.
function translateHistoryCreateError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    throw new EducatorNotFoundError();
  }

  throw error;
}

export class PrismaTrainingSessionRepository implements TrainingSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    educatorId: string,
    input: {
      title: string;
      ageGroup: AgeGroup;
      playerCount: number;
      theme: DevelopmentTheme;
      intention: string;
      blocks: PersistedTrainingSessionBlock[];
    },
  ): Promise<PersistedTrainingSession> {
    try {
      const record = await this.prisma.trainingSessionRecord.create({
        data: {
          educatorId,
          title: input.title,
          ageGroup: toPrismaAgeGroup(input.ageGroup),
          playerCount: input.playerCount,
          theme: toPrismaDevelopmentTheme(input.theme),
          intention: input.intention,
          blocks: input.blocks as unknown as Prisma.InputJsonValue,
        },
      });
      return toPersistedTrainingSession(record);
    } catch (error) {
      return translateHistoryCreateError(error);
    }
  }
}

export class PrismaObservationRepository implements ObservationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(educatorId: string, report: ObservationReport): Promise<PersistedObservation> {
    try {
      const record = await this.prisma.observationRecord.create({
        data: {
          educatorId,
          eventType: toPrismaObservationEventType(report.eventType),
          title: report.title,
          dateLabel: report.dateLabel,
          players: report.players as unknown as Prisma.InputJsonValue,
          ratings: report.ratings as unknown as Prisma.InputJsonValue,
          signals: report.signals as unknown as Prisma.InputJsonValue,
          note: report.note ?? null,
          summary: report.summary as unknown as Prisma.InputJsonValue,
        },
      });
      return toPersistedObservation(record);
    } catch (error) {
      return translateHistoryCreateError(error);
    }
  }
}

function translatePlayerCreateError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    throw new EducatorNotFoundError();
  }
  throw error;
}

export class PrismaPlayerRepository implements PlayerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByEducator(educatorId: string): Promise<PersistedPlayer[]> {
    const players = await this.prisma.player.findMany({ where: { educatorId }, orderBy: { createdAt: "asc" } });
    return players.map(toPersistedPlayer);
  }

  async create(educatorId: string, name: string): Promise<PersistedPlayer> {
    try {
      const player = await this.prisma.player.create({ data: { educatorId, name } });
      return toPersistedPlayer(player);
    } catch (error) {
      return translatePlayerCreateError(error);
    }
  }

  // `updateMany`/`deleteMany` (plutôt que `update`/`delete`, qui ne peuvent filtrer que sur une
  // clé unique) vérifient l'appartenance à `educatorId` dans la même requête que l'écriture --
  // jamais un `findUnique` puis un `update` séparés, qui laisserait une fenêtre entre la
  // vérification et l'écriture.
  async rename(id: string, educatorId: string, name: string): Promise<PersistedPlayer> {
    const { count } = await this.prisma.player.updateMany({ where: { id, educatorId }, data: { name } });
    if (count === 0) {
      throw new PlayerNotFoundError();
    }
    const player = await this.prisma.player.findUniqueOrThrow({ where: { id } });
    return toPersistedPlayer(player);
  }

  async remove(id: string, educatorId: string): Promise<void> {
    const { count } = await this.prisma.player.deleteMany({ where: { id, educatorId } });
    if (count === 0) {
      throw new PlayerNotFoundError();
    }
  }
}
