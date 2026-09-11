import { Prisma } from "./generated/prisma/client";
import type { PrismaClient } from "./generated/prisma/client";
import {
  DiagnosticNotFoundError,
  DuplicateEducatorEmailError,
  EducatorNotFoundError,
  MatchNotFoundError,
  PlayerEvaluationNotFoundError,
  PlayerNotFoundError,
  TeamNotFoundError,
  TrainingSessionNotFoundError,
} from "./errors";
import {
  toEducatorAuthRecord,
  toEducatorProfile,
  toEducatorRecord,
  toPersistedDiagnostic,
  toPersistedMatch,
  toPersistedMessage,
  toPersistedObservation,
  toPersistedPlayer,
  toPersistedPlayerEvaluation,
  toPersistedTeamProfile,
  toPersistedPlateau,
  toPersistedTournament,
  toPersistedTrainingSession,
  toPrismaAgeGroup,
  toPrismaDevelopmentTheme,
  toPrismaMatchStatus,
  toPrismaMatchVenue,
  toPrismaMessageAuthorRole,
  toPrismaObservationEventType,
  toPrismaTrainingDay,
  toPlayerInviteRecord,
  toEmailVerificationRecord,
  toSessionRecord,
} from "./mappers";
import { ContactMessageRecord, ContactMessageRepository } from "./contact-message-service";
import { normalizeEducatorEmail } from "./email";
import type {
  DiagnosticRepository,
  EducatorAuthRecord,
  EducatorProfile,
  EducatorProfilePatch,
  EducatorProfileRepository,
  EducatorRecord,
  EducatorRepository,
  EmailVerificationRecord,
  EmailVerificationRepository,
  MatchRepository,
  MessageRepository,
  ObservationRepository,
  PersistedDiagnostic,
  PersistedMatch,
  PersistedMessage,
  PersistedObservation,
  PersistedPlateau,
  PersistedPlayer,
  PersistedPlayerEvaluation,
  PersistedTeamProfile,
  PersistedTournament,
  PersistedTrainingSession,
  PersistedTrainingSessionBlock,
  PlateauRepository,
  PlayerDetailsPatch,
  PlayerEvaluationRepository,
  PlayerRepository,
  PlayerInviteRecord,
  PlayerInviteRepository,
  SessionRecord,
  SessionRepository,
  TeamRepository,
  TournamentRepository,
  TrainingSessionRepository,
} from "./repositories";
import type {
  AgeGroup,
  AttendanceEntry,
  DevelopmentTheme,
  DiagnosticScores,
  GameFormat,
  MatchLineupAssignment,
  MatchStatus,
  MatchVenue,
  MessageAuthorRole as DomainMessageAuthorRole,
  ObservationReport,
  PlayerEvaluationScores,
  TeamProfile,
} from "@evolyfoot/domain";

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

export class PrismaEducatorRepository implements EducatorRepository, EducatorProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    email: string;
    displayName: string;
    passwordHash: string;
    role?: "coach" | "player";
    linkedPlayerId?: string;
  }): Promise<EducatorRecord> {
    try {
      const educator = await this.prisma.educator.create({
        data: {
          email: normalizeEducatorEmail(input.email),
          displayName: input.displayName,
          passwordHash: input.passwordHash,
          ...(input.role ? { role: input.role } : {}),
          ...(input.linkedPlayerId ? { linkedPlayerId: input.linkedPlayerId } : {}),
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

  async findByLinkedPlayerId(playerId: string): Promise<EducatorRecord | null> {
    const educator = await this.prisma.educator.findUnique({ where: { linkedPlayerId: playerId } });
    return educator === null ? null : toEducatorRecord(educator);
  }

  async findProfileById(id: string): Promise<EducatorProfile | null> {
    const educator = await this.prisma.educator.findUnique({ where: { id } });
    return educator === null ? null : toEducatorProfile(educator);
  }

  async findAuthById(id: string): Promise<EducatorAuthRecord | null> {
    const educator = await this.prisma.educator.findUnique({ where: { id } });
    return educator === null ? null : toEducatorAuthRecord(educator);
  }

  async updateProfile(id: string, patch: EducatorProfilePatch): Promise<EducatorProfile> {
    const educator = await this.prisma.educator.update({ where: { id }, data: patch });
    return toEducatorProfile(educator);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.educator.update({ where: { id }, data: { passwordHash } });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.prisma.educator.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
  }
}

export class PrismaEmailVerificationRepository implements EmailVerificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: { educatorId: string; tokenHash: string; expiresAt: Date }): Promise<EmailVerificationRecord> {
    const verification = await this.prisma.emailVerification.create({ data: input });
    return toEmailVerificationRecord(verification);
  }

  async findByTokenHash(tokenHash: string): Promise<EmailVerificationRecord | null> {
    const verification = await this.prisma.emailVerification.findUnique({ where: { tokenHash } });
    return verification === null ? null : toEmailVerificationRecord(verification);
  }

  async markConsumed(id: string): Promise<void> {
    await this.prisma.emailVerification.update({ where: { id }, data: { consumedAt: new Date() } });
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

export class PrismaPlayerInviteRepository implements PlayerInviteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: { educatorId: string; playerId: string; tokenHash: string; expiresAt: Date }): Promise<PlayerInviteRecord> {
    const invite = await this.prisma.playerInvite.create({ data: input });
    return toPlayerInviteRecord(invite);
  }

  async findByTokenHash(tokenHash: string): Promise<PlayerInviteRecord | null> {
    const invite = await this.prisma.playerInvite.findUnique({ where: { tokenHash } });
    return invite === null ? null : toPlayerInviteRecord(invite);
  }

  // Invitation encore utilisable pour ce joueur : non consommée et non expirée.
  async findActiveForPlayer(playerId: string): Promise<PlayerInviteRecord | null> {
    const invite = await this.prisma.playerInvite.findFirst({
      where: { playerId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    return invite === null ? null : toPlayerInviteRecord(invite);
  }

  async markConsumed(id: string): Promise<void> {
    await this.prisma.playerInvite.update({ where: { id }, data: { consumedAt: new Date() } });
  }
}

export class PrismaMessageRepository implements MessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByPlayer(educatorId: string, playerId: string): Promise<PersistedMessage[]> {
    const records = await this.prisma.messageRecord.findMany({
      where: { educatorId, playerId },
      orderBy: { createdAt: "asc" },
    });
    return records.map(toPersistedMessage);
  }

  async create(input: {
    educatorId: string;
    playerId: string;
    authorRole: DomainMessageAuthorRole;
    authorName: string;
    text: string;
  }): Promise<PersistedMessage> {
    const record = await this.prisma.messageRecord.create({
      data: {
        educatorId: input.educatorId,
        playerId: input.playerId,
        authorRole: toPrismaMessageAuthorRole(input.authorRole),
        authorName: input.authorName,
        text: input.text,
      },
    });
    return toPersistedMessage(record);
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
      weekNumber: number;
      slot: number;
      attendance?: readonly AttendanceEntry[];
    },
  ): Promise<PersistedTrainingSession> {
    const blocks = input.blocks as unknown as Prisma.InputJsonValue;
    const attendance = input.attendance ? (input.attendance as unknown as Prisma.InputJsonValue) : undefined;
    try {
      // Upsert sur le créneau : (re)générer la séance d'un créneau déjà occupé la remplace.
      const record = await this.prisma.trainingSessionRecord.upsert({
        where: {
          training_session_slot: { educatorId, weekNumber: input.weekNumber, slot: input.slot },
        },
        create: {
          educatorId,
          title: input.title,
          ageGroup: toPrismaAgeGroup(input.ageGroup),
          playerCount: input.playerCount,
          theme: toPrismaDevelopmentTheme(input.theme),
          intention: input.intention,
          blocks,
          weekNumber: input.weekNumber,
          slot: input.slot,
          attendance,
        },
        update: {
          title: input.title,
          ageGroup: toPrismaAgeGroup(input.ageGroup),
          playerCount: input.playerCount,
          theme: toPrismaDevelopmentTheme(input.theme),
          intention: input.intention,
          blocks,
          ...(attendance !== undefined ? { attendance } : {}),
        },
      });
      return toPersistedTrainingSession(record);
    } catch (error) {
      return translateHistoryCreateError(error);
    }
  }

  async listByEducator(educatorId: string): Promise<PersistedTrainingSession[]> {
    const records = await this.prisma.trainingSessionRecord.findMany({ where: { educatorId }, orderBy: { createdAt: "desc" } });
    return records.map(toPersistedTrainingSession);
  }

  async findById(id: string, educatorId: string): Promise<PersistedTrainingSession | null> {
    const record = await this.prisma.trainingSessionRecord.findFirst({ where: { id, educatorId } });
    return record ? toPersistedTrainingSession(record) : null;
  }

  async update(
    id: string,
    educatorId: string,
    input: {
      meetingAt?: Date | null;
      location?: string | null;
      description?: string | null;
      attendance?: readonly AttendanceEntry[];
    },
  ): Promise<PersistedTrainingSession> {
    const { count } = await this.prisma.trainingSessionRecord.updateMany({
      where: { id, educatorId },
      data: {
        ...(input.meetingAt !== undefined ? { meetingAt: input.meetingAt } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.attendance !== undefined ? { attendance: input.attendance as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    if (count === 0) {
      throw new TrainingSessionNotFoundError();
    }
    const record = await this.prisma.trainingSessionRecord.findUniqueOrThrow({ where: { id } });
    return toPersistedTrainingSession(record);
  }
}

export class PrismaObservationRepository implements ObservationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByEducator(educatorId: string): Promise<PersistedObservation[]> {
    const records = await this.prisma.observationRecord.findMany({ where: { educatorId }, orderBy: { createdAt: "desc" } });
    return records.map(toPersistedObservation);
  }

  async findById(id: string, educatorId: string): Promise<PersistedObservation | null> {
    const record = await this.prisma.observationRecord.findFirst({ where: { id, educatorId } });
    return record === null ? null : toPersistedObservation(record);
  }

  async create(educatorId: string, report: ObservationReport, matchId?: string): Promise<PersistedObservation> {
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
          matchId: matchId ?? null,
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

  async findById(id: string, educatorId: string): Promise<PersistedPlayer | null> {
    const player = await this.prisma.player.findFirst({ where: { id, educatorId } });
    return player === null ? null : toPersistedPlayer(player);
  }

  async findAnyById(id: string): Promise<PersistedPlayer | null> {
    const player = await this.prisma.player.findUnique({ where: { id } });
    return player === null ? null : toPersistedPlayer(player);
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
    return this.update(id, educatorId, { name });
  }

  async update(id: string, educatorId: string, patch: PlayerDetailsPatch): Promise<PersistedPlayer> {
    const { count } = await this.prisma.player.updateMany({ where: { id, educatorId }, data: patch });
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

function translateMatchCreateError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    throw new EducatorNotFoundError();
  }
  throw error;
}

export class PrismaMatchRepository implements MatchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByEducator(educatorId: string): Promise<PersistedMatch[]> {
    const matches = await this.prisma.matchRecord.findMany({ where: { educatorId }, orderBy: { createdAt: "desc" } });
    return matches.map(toPersistedMatch);
  }

  async findById(id: string, educatorId: string): Promise<PersistedMatch | null> {
    const match = await this.prisma.matchRecord.findFirst({ where: { id, educatorId } });
    return match === null ? null : toPersistedMatch(match);
  }

  async create(
    educatorId: string,
    input: {
      opponent: string;
      dateLabel: string;
      venue: MatchVenue;
      gameFormat: GameFormat;
      formationId: string;
      date?: Date | null;
      meetingTime?: string | null;
      location?: string | null;
      description?: string | null;
    },
  ): Promise<PersistedMatch> {
    try {
      const match = await this.prisma.matchRecord.create({
        data: {
          educatorId,
          opponent: input.opponent,
          dateLabel: input.dateLabel,
          date: input.date ?? null,
          venue: toPrismaMatchVenue(input.venue),
          gameFormat: input.gameFormat,
          formationId: input.formationId,
          meetingTime: input.meetingTime,
          location: input.location,
          description: input.description,
        },
      });
      return toPersistedMatch(match);
    } catch (error) {
      return translateMatchCreateError(error);
    }
  }

  // `updateMany` (plutôt que `update`, qui ne peut filtrer que sur une clé unique) vérifie
  // l'appartenance à `educatorId` dans la même requête que l'écriture -- même principe que
  // PrismaPlayerRepository.rename ci-dessus.
  async update(
    id: string,
    educatorId: string,
    input: {
      opponent?: string;
      dateLabel?: string;
      date?: Date | null;
      venue?: MatchVenue;
      formationId?: string;
      status?: MatchStatus;
      lineup?: readonly MatchLineupAssignment[];
      captainPlayerId?: string | null;
      substitutePlayerIds?: readonly string[];
      attendance?: readonly AttendanceEntry[];
      meetingTime?: string | null;
      location?: string | null;
      description?: string | null;
    },
  ): Promise<PersistedMatch> {
    const { count } = await this.prisma.matchRecord.updateMany({
      where: { id, educatorId },
      data: {
        ...(input.opponent !== undefined ? { opponent: input.opponent } : {}),
        ...(input.meetingTime !== undefined ? { meetingTime: input.meetingTime } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.dateLabel !== undefined ? { dateLabel: input.dateLabel } : {}),
        ...(input.date !== undefined ? { date: input.date } : {}),
        ...(input.venue !== undefined ? { venue: toPrismaMatchVenue(input.venue) } : {}),
        ...(input.formationId !== undefined ? { formationId: input.formationId } : {}),
        ...(input.status !== undefined ? { status: toPrismaMatchStatus(input.status) } : {}),
        ...(input.lineup !== undefined ? { lineup: input.lineup as unknown as Prisma.InputJsonValue } : {}),
        ...(input.captainPlayerId !== undefined ? { captainPlayerId: input.captainPlayerId } : {}),
        ...(input.substitutePlayerIds !== undefined
          ? { substitutePlayerIds: input.substitutePlayerIds as unknown as Prisma.InputJsonValue }
          : {}),
        ...(input.attendance !== undefined ? { attendance: input.attendance as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    if (count === 0) {
      throw new MatchNotFoundError();
    }
    const match = await this.prisma.matchRecord.findUniqueOrThrow({ where: { id } });
    return toPersistedMatch(match);
  }

  async remove(id: string, educatorId: string): Promise<void> {
    const { count } = await this.prisma.matchRecord.deleteMany({ where: { id, educatorId } });
    if (count === 0) {
      throw new MatchNotFoundError();
    }
  }
}

export class PrismaTournamentRepository implements TournamentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByEducator(educatorId: string): Promise<PersistedTournament[]> {
    const records = await this.prisma.tournamentRecord.findMany({ where: { educatorId }, orderBy: { createdAt: "desc" } });
    return records.map(toPersistedTournament);
  }

  async create(educatorId: string, input: { name: string; dateLabel: string; date?: Date | null; result?: string }): Promise<PersistedTournament> {
    const record = await this.prisma.tournamentRecord.create({
      data: { educatorId, name: input.name, dateLabel: input.dateLabel, date: input.date ?? null, result: input.result ?? null },
    });
    return toPersistedTournament(record);
  }

  // Pas de garde-fou "0 ligne supprimée" ici (contrairement à PrismaMatchRepository.remove) :
  // supprimer un tournoi déjà supprimé ou inexistant, ou d'un autre éducateur, ne fait
  // simplement rien plutôt que d'échouer -- une fiche simple sans conséquence en cascade sur
  // d'autres données, contrairement à un match (composition, observations liées).
  async remove(id: string, educatorId: string): Promise<void> {
    await this.prisma.tournamentRecord.deleteMany({ where: { id, educatorId } });
  }
}

export class PrismaPlateauRepository implements PlateauRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByEducator(educatorId: string): Promise<PersistedPlateau[]> {
    const records = await this.prisma.plateauRecord.findMany({ where: { educatorId }, orderBy: { createdAt: "desc" } });
    return records.map(toPersistedPlateau);
  }

  async create(educatorId: string, input: { name: string; dateLabel: string; date?: Date | null; result?: string }): Promise<PersistedPlateau> {
    const record = await this.prisma.plateauRecord.create({
      data: { educatorId, name: input.name, dateLabel: input.dateLabel, date: input.date ?? null, result: input.result ?? null },
    });
    return toPersistedPlateau(record);
  }

  // Même choix que PrismaTournamentRepository.remove : supprimer une fiche inexistante ou d'un
  // autre éducateur ne fait rien plutôt que d'échouer.
  async remove(id: string, educatorId: string): Promise<void> {
    await this.prisma.plateauRecord.deleteMany({ where: { id, educatorId } });
  }
}

export class PrismaContactMessageRepository implements ContactMessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: { name: string; email: string; message: string }): Promise<ContactMessageRecord> {
    const record = await this.prisma.contactMessage.create({ data: input });
    return { id: record.id, name: record.name, email: record.email, message: record.message, createdAt: record.createdAt };
  }

  async list(limit: number): Promise<ContactMessageRecord[]> {
    const records = await this.prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return records.map((record) => ({
      id: record.id,
      name: record.name,
      email: record.email,
      message: record.message,
      createdAt: record.createdAt,
    }));
  }
}

export class PrismaPlayerEvaluationRepository implements PlayerEvaluationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByEducator(educatorId: string): Promise<PersistedPlayerEvaluation[]> {
    const records = await this.prisma.playerEvaluationRecord.findMany({
      where: { educatorId },
      orderBy: { createdAt: "desc" },
    });
    return records.map(toPersistedPlayerEvaluation);
  }

  async listByPlayer(playerId: string, educatorId: string): Promise<PersistedPlayerEvaluation[]> {
    const records = await this.prisma.playerEvaluationRecord.findMany({
      where: { playerId, educatorId },
      orderBy: { createdAt: "desc" },
    });
    return records.map(toPersistedPlayerEvaluation);
  }

  async countByPlayer(playerId: string, educatorId: string): Promise<number> {
    return this.prisma.playerEvaluationRecord.count({ where: { playerId, educatorId } });
  }

  async create(educatorId: string, playerId: string, scores: PlayerEvaluationScores): Promise<PersistedPlayerEvaluation> {
    try {
      const record = await this.prisma.playerEvaluationRecord.create({
        data: { educatorId, playerId, scores: scores as unknown as Prisma.InputJsonValue },
      });
      return toPersistedPlayerEvaluation(record);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new PlayerNotFoundError();
      }
      throw error;
    }
  }

  async update(
    id: string,
    educatorId: string,
    input: { scores?: PlayerEvaluationScores; createdAt?: Date },
  ): Promise<PersistedPlayerEvaluation> {
    const { count } = await this.prisma.playerEvaluationRecord.updateMany({
      where: { id, educatorId },
      data: {
        ...(input.scores !== undefined ? { scores: input.scores as unknown as Prisma.InputJsonValue } : {}),
        ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
      },
    });
    if (count === 0) {
      throw new PlayerEvaluationNotFoundError();
    }
    const record = await this.prisma.playerEvaluationRecord.findUniqueOrThrow({ where: { id } });
    return toPersistedPlayerEvaluation(record);
  }

  async remove(id: string, educatorId: string): Promise<void> {
    await this.prisma.playerEvaluationRecord.deleteMany({ where: { id, educatorId } });
  }
}
