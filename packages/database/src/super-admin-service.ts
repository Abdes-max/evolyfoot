import { billingAccess } from "@evolyfoot/domain";
import type { PrismaClient } from "./generated/prisma/client";
import { normalizeEducatorEmail, validateEmailFormat } from "./email";
import { DuplicateEducatorEmailError, EducatorNotFoundError, InvalidCredentialsError, ValidationError } from "./errors";
import { MAX_PASSWORD_LENGTH, hashPassword, verifyPassword } from "./password";
import { generateSessionToken, hashSessionToken } from "./session-token";

// Compte superadmin : jamais un rôle d'éducateur, créé uniquement par script (voir
// scripts/create-super-admin.mjs). Session et jeton propres, durée courte.
export const superAdminMinPasswordLength = 12;
const superAdminSessionMs = 8 * 60 * 60 * 1000;
// « Se connecter en tant que » : une demi-heure, puis l'éducateur reprend la main.
export const impersonationSessionMs = 30 * 60 * 1000;

export interface SuperAdminRecord {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface SuperAdminLogin {
  superAdmin: SuperAdminRecord;
  sessionToken: string;
  expiresAt: Date;
}

export type AdminEducatorFilter = "all" | "trial" | "subscribed" | "expired" | "suspended" | "test";

export interface AdminEducatorItem {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  emailVerified: boolean;
  suspended: boolean;
  isTest: boolean;
  access: "subscribed" | "trial" | "expired";
  subscriptionStatus: string | null;
  players: number;
  matches: number;
}

export interface AdminEducatorDetail extends AdminEducatorItem {
  suspendedAt: Date | null;
  trialEndsAt: Date | null;
  billingCycle: string | null;
  currentPeriodEnd: Date | null;
  subscriptionCancelAt: Date | null;
  stripeCustomerId: string | null;
  club: string | null;
  counts: {
    players: number;
    matches: number;
    trainingSessions: number;
    observations: number;
    tournaments: number;
    plateaux: number;
    teams: number;
    assistants: number;
  };
  lastSessionAt: Date | null;
}

export interface AdminAuditEntry {
  id: string;
  superAdminEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  note: string | null;
  createdAt: Date;
}

export interface AdminStats {
  educators: { total: number; real: number; test: number; verified: number; suspended: number; signupsLast7Days: number; signupsLast30Days: number };
  access: { subscribed: number; trial: number; expired: number };
  content: { players: number; matches: number; trainingSessions: number; observations: number };
}

export type AdminAuditTarget = { type: string; id?: string | null; label?: string | null };

function toSuperAdmin(row: { id: string; email: string; displayName: string; createdAt: Date; lastLoginAt: Date | null }): SuperAdminRecord {
  return Object.freeze({ id: row.id, email: row.email, displayName: row.displayName, createdAt: row.createdAt, lastLoginAt: row.lastLoginAt });
}

function validateSuperAdminPassword(password: string): string {
  if (password.length < superAdminMinPasswordLength) {
    throw new ValidationError(`Le mot de passe doit contenir au moins ${superAdminMinPasswordLength} caractères.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new ValidationError(`Le mot de passe ne doit pas dépasser ${MAX_PASSWORD_LENGTH} caractères.`);
  }
  return password;
}

let absentHash: Promise<string> | null = null;

export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // --- Compte et session ------------------------------------------------------------------

  async createAccount(input: { email: string; displayName: string; password: string }): Promise<SuperAdminRecord> {
    let email: string;
    try {
      email = validateEmailFormat(normalizeEducatorEmail(input.email));
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : "Adresse e-mail invalide.");
    }
    const displayName = input.displayName.trim();
    if (!displayName || displayName.length > 120) {
      throw new ValidationError("Indique un nom (120 caractères maximum).");
    }
    const passwordHash = await hashPassword(validateSuperAdminPassword(input.password));
    if (await this.prisma.superAdmin.findUnique({ where: { email } })) {
      throw new DuplicateEducatorEmailError();
    }
    return toSuperAdmin(await this.prisma.superAdmin.create({ data: { email, displayName, passwordHash } }));
  }

  async login(input: { email: string; password: string }): Promise<SuperAdminLogin> {
    let email: string;
    try {
      email = normalizeEducatorEmail(input.email);
    } catch {
      throw new InvalidCredentialsError();
    }
    if (input.password.length > MAX_PASSWORD_LENGTH) {
      throw new InvalidCredentialsError();
    }
    const row = await this.prisma.superAdmin.findUnique({ where: { email } });
    if (!row) {
      // Même calcul que pour un compte existant : le temps de réponse ne révèle pas l'adresse.
      absentHash ??= hashPassword("compte-superadmin-absent");
      await verifyPassword(input.password, await absentHash);
      throw new InvalidCredentialsError();
    }
    if (!(await verifyPassword(input.password, row.passwordHash))) {
      throw new InvalidCredentialsError();
    }
    const now = this.now();
    const updated = await this.prisma.superAdmin.update({ where: { id: row.id }, data: { lastLoginAt: now } });
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(now.getTime() + superAdminSessionMs);
    await this.prisma.superAdminSession.create({ data: { superAdminId: row.id, tokenHash: hashSessionToken(sessionToken), expiresAt } });
    return { superAdmin: toSuperAdmin(updated), sessionToken, expiresAt };
  }

  async logout(sessionToken: string): Promise<void> {
    await this.prisma.superAdminSession.deleteMany({ where: { tokenHash: hashSessionToken(sessionToken) } });
  }

  async getBySession(sessionToken: string): Promise<SuperAdminRecord | null> {
    const session = await this.prisma.superAdminSession.findFirst({
      where: { tokenHash: hashSessionToken(sessionToken), expiresAt: { gt: this.now() } },
      include: { superAdmin: true },
    });
    return session ? toSuperAdmin(session.superAdmin) : null;
  }

  async changePassword(superAdminId: string, input: { currentPassword: string; newPassword: string }, keepSessionToken: string | null): Promise<void> {
    const row = await this.prisma.superAdmin.findUnique({ where: { id: superAdminId } });
    if (!row || input.currentPassword.length > MAX_PASSWORD_LENGTH || !(await verifyPassword(input.currentPassword, row.passwordHash))) {
      throw new InvalidCredentialsError();
    }
    const passwordHash = await hashPassword(validateSuperAdminPassword(input.newPassword));
    await this.prisma.superAdmin.update({ where: { id: superAdminId }, data: { passwordHash } });
    // Les autres sessions de ce compte sont fermées : seule celle qui change le mot de passe reste.
    await this.prisma.superAdminSession.deleteMany({
      where: { superAdminId, ...(keepSessionToken ? { tokenHash: { not: hashSessionToken(keepSessionToken) } } : {}) },
    });
  }

  // --- Journal d'audit --------------------------------------------------------------------

  async recordAudit(superAdminId: string, action: string, target: AdminAuditTarget, note?: string | null): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: {
        superAdminId,
        action,
        targetType: target.type,
        targetId: target.id ?? null,
        targetLabel: target.label ?? null,
        note: note?.trim().slice(0, 500) || null,
      },
    });
  }

  async listAudit(input: { page?: number; pageSize?: number; action?: string; search?: string } = {}): Promise<{ items: AdminAuditEntry[]; total: number }> {
    const pageSize = Math.min(Math.max(input.pageSize ?? 50, 1), 100);
    const page = Math.max(input.page ?? 1, 1);
    const search = input.search?.trim();
    const where = {
      ...(input.action ? { action: input.action } : {}),
      ...(search
        ? { OR: [{ targetLabel: { contains: search, mode: "insensitive" as const } }, { note: { contains: search, mode: "insensitive" as const } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { superAdmin: { select: { email: true } } },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        superAdminEmail: row.superAdmin.email,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        targetLabel: row.targetLabel,
        note: row.note,
        createdAt: row.createdAt,
      })),
    };
  }

  // --- Statistiques et éducateurs ---------------------------------------------------------

  async stats(): Promise<AdminStats> {
    const now = this.now();
    const day = 24 * 60 * 60 * 1000;
    const coaches = { role: "coach" };
    const real = { ...coaches, isTest: false };
    const [total, test, verified, suspended, last7, last30, players, matches, trainingSessions, observations, accounts] = await Promise.all([
      this.prisma.educator.count({ where: coaches }),
      this.prisma.educator.count({ where: { ...coaches, isTest: true } }),
      this.prisma.educator.count({ where: { ...real, emailVerifiedAt: { not: null } } }),
      this.prisma.educator.count({ where: { ...real, suspendedAt: { not: null } } }),
      this.prisma.educator.count({ where: { ...real, createdAt: { gte: new Date(now.getTime() - 7 * day) } } }),
      this.prisma.educator.count({ where: { ...real, createdAt: { gte: new Date(now.getTime() - 30 * day) } } }),
      this.prisma.player.count(),
      this.prisma.matchRecord.count(),
      this.prisma.trainingSessionRecord.count(),
      this.prisma.observationRecord.count(),
      this.prisma.educator.findMany({ where: real, select: { createdAt: true, trialEndsAt: true, subscriptionStatus: true } }),
    ]);
    const access = { subscribed: 0, trial: 0, expired: 0 };
    for (const account of accounts) {
      access[billingAccess({ createdAt: account.createdAt, trialEndsAt: account.trialEndsAt, subscriptionStatus: account.subscriptionStatus, now }).state] += 1;
    }
    return {
      educators: { total, real: total - test, test, verified, suspended, signupsLast7Days: last7, signupsLast30Days: last30 },
      access,
      content: { players, matches, trainingSessions, observations },
    };
  }

  async listEducators(
    input: { search?: string; filter?: AdminEducatorFilter; page?: number; pageSize?: number } = {},
  ): Promise<{ items: AdminEducatorItem[]; total: number }> {
    const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100);
    const page = Math.max(input.page ?? 1, 1);
    const search = input.search?.trim();
    const filter = input.filter ?? "all";
    const now = this.now();
    // « trial / subscribed / expired » se calculent avec les règles du domaine : on filtre donc après lecture
    // sur ce critère, en gardant un plafond raisonnable (un coach par ligne).
    const where = {
      role: "coach",
      ...(filter === "suspended" ? { suspendedAt: { not: null } } : {}),
      ...(filter === "test" ? { isTest: true } : {}),
      ...(search
        ? { OR: [{ email: { contains: search, mode: "insensitive" as const } }, { displayName: { contains: search, mode: "insensitive" as const } }] }
        : {}),
    };
    const rows = await this.prisma.educator.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { players: true, matches: true } } },
    });
    const items = rows
      .map((row): AdminEducatorItem => ({
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        createdAt: row.createdAt,
        emailVerified: row.emailVerifiedAt !== null,
        suspended: row.suspendedAt !== null,
        isTest: row.isTest,
        access: billingAccess({ createdAt: row.createdAt, trialEndsAt: row.trialEndsAt, subscriptionStatus: row.subscriptionStatus, now }).state,
        subscriptionStatus: row.subscriptionStatus,
        players: row._count.players,
        matches: row._count.matches,
      }))
      .filter((item) => (filter === "trial" || filter === "subscribed" || filter === "expired" ? item.access === filter : true));
    return { total: items.length, items: items.slice((page - 1) * pageSize, page * pageSize) };
  }

  async getEducator(educatorId: string): Promise<AdminEducatorDetail> {
    const row = await this.prisma.educator.findFirst({
      where: { id: educatorId, role: "coach" },
      include: {
        _count: { select: { players: true, matches: true, trainingSessions: true, observations: true, tournaments: true, plateaux: true } },
        sharingClub: { select: { name: true } },
      },
    });
    if (!row) {
      throw new EducatorNotFoundError();
    }
    const [teams, assistants, lastSession] = await Promise.all([
      this.prisma.educator.count({ where: { ownerEducatorId: row.id, role: "team" } }),
      this.prisma.educator.count({ where: { ownerEducatorId: row.id, role: "assistant" } }),
      this.prisma.session.findFirst({ where: { educatorId: row.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    const now = this.now();
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      createdAt: row.createdAt,
      emailVerified: row.emailVerifiedAt !== null,
      suspended: row.suspendedAt !== null,
      isTest: row.isTest,
      access: billingAccess({ createdAt: row.createdAt, trialEndsAt: row.trialEndsAt, subscriptionStatus: row.subscriptionStatus, now }).state,
      subscriptionStatus: row.subscriptionStatus,
      players: row._count.players,
      matches: row._count.matches,
      suspendedAt: row.suspendedAt,
      trialEndsAt: row.trialEndsAt,
      billingCycle: row.billingCycle,
      currentPeriodEnd: row.currentPeriodEnd,
      subscriptionCancelAt: row.subscriptionCancelAt,
      stripeCustomerId: row.stripeCustomerId,
      club: row.sharingClub?.name ?? null,
      counts: {
        players: row._count.players,
        matches: row._count.matches,
        trainingSessions: row._count.trainingSessions,
        observations: row._count.observations,
        tournaments: row._count.tournaments,
        plateaux: row._count.plateaux,
        teams,
        assistants,
      },
      lastSessionAt: lastSession?.createdAt ?? null,
    };
  }

  // --- Actions ----------------------------------------------------------------------------

  private async coach(educatorId: string) {
    const row = await this.prisma.educator.findFirst({ where: { id: educatorId, role: "coach" } });
    if (!row) {
      throw new EducatorNotFoundError();
    }
    return row;
  }

  // Suspendu : plus de connexion, et ses sessions ouvertes sont fermées.
  async suspend(superAdminId: string, educatorId: string, note?: string | null): Promise<void> {
    const row = await this.coach(educatorId);
    await this.prisma.educator.update({ where: { id: row.id }, data: { suspendedAt: this.now() } });
    await this.prisma.session.deleteMany({ where: { educatorId: row.id } });
    await this.recordAudit(superAdminId, "educator.suspend", { type: "educator", id: row.id, label: row.email }, note);
  }

  async reactivate(superAdminId: string, educatorId: string, note?: string | null): Promise<void> {
    const row = await this.coach(educatorId);
    await this.prisma.educator.update({ where: { id: row.id }, data: { suspendedAt: null } });
    await this.recordAudit(superAdminId, "educator.reactivate", { type: "educator", id: row.id, label: row.email }, note);
  }

  async setTest(superAdminId: string, educatorId: string, isTest: boolean): Promise<void> {
    const row = await this.coach(educatorId);
    await this.prisma.educator.update({ where: { id: row.id }, data: { isTest } });
    await this.recordAudit(superAdminId, isTest ? "educator.mark-test" : "educator.unmark-test", { type: "educator", id: row.id, label: row.email });
  }

  async verifyEmail(superAdminId: string, educatorId: string): Promise<void> {
    const row = await this.coach(educatorId);
    if (!row.emailVerifiedAt) {
      await this.prisma.educator.update({ where: { id: row.id }, data: { emailVerifiedAt: this.now() } });
    }
    await this.recordAudit(superAdminId, "educator.verify-email", { type: "educator", id: row.id, label: row.email });
  }

  // Prolonge l'essai de `days` jours à partir de la fin d'essai actuelle (ou d'aujourd'hui si elle est passée).
  async extendTrial(superAdminId: string, educatorId: string, days: number, note?: string | null): Promise<Date> {
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      throw new ValidationError("Indique une durée entière entre 1 et 90 jours.");
    }
    const row = await this.coach(educatorId);
    const now = this.now();
    const current = row.trialEndsAt ?? new Date(row.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    const base = current.getTime() > now.getTime() ? current : now;
    const trialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    await this.prisma.educator.update({ where: { id: row.id }, data: { trialEndsAt } });
    await this.recordAudit(superAdminId, "educator.extend-trial", { type: "educator", id: row.id, label: row.email }, note ?? `+${days} jours`);
    return trialEndsAt;
  }

  // Suppression définitive : exige l'adresse e-mail du compte en toutes lettres. Les données de l'éducateur
  // partent avec lui (suppression en cascade), comme pour la suppression de compte par l'éducateur.
  async deleteEducator(superAdminId: string, educatorId: string, confirmEmail: string): Promise<void> {
    const row = await this.coach(educatorId);
    if (confirmEmail.trim().toLowerCase() !== row.email.toLowerCase()) {
      throw new ValidationError("Saisis l'adresse e-mail du compte pour confirmer la suppression.");
    }
    await this.recordAudit(superAdminId, "educator.delete", { type: "educator", id: row.id, label: row.email });
    await this.prisma.educator.delete({ where: { id: row.id } });
  }

  // --- « Se connecter en tant que » -------------------------------------------------------

  async startImpersonation(superAdminId: string, educatorId: string): Promise<{ sessionToken: string; expiresAt: Date }> {
    const row = await this.coach(educatorId);
    if (row.suspendedAt) {
      throw new ValidationError("Ce compte est suspendu : réactive-le avant de te connecter en tant que lui.");
    }
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(this.now().getTime() + impersonationSessionMs);
    await this.prisma.session.create({
      data: { educatorId: row.id, tokenHash: hashSessionToken(sessionToken), expiresAt, impersonatedBySuperAdminId: superAdminId },
    });
    await this.recordAudit(superAdminId, "impersonation.start", { type: "educator", id: row.id, label: row.email });
    return { sessionToken, expiresAt };
  }

  // Ferme une session d'impersonation (le jeton est celui de l'éducateur) et le note dans le journal.
  async stopImpersonation(sessionToken: string): Promise<boolean> {
    const session = await this.prisma.session.findFirst({
      where: { tokenHash: hashSessionToken(sessionToken), impersonatedBySuperAdminId: { not: null } },
      include: { educator: { select: { id: true, email: true } } },
    });
    if (!session?.impersonatedBySuperAdminId) {
      return false;
    }
    await this.prisma.session.delete({ where: { id: session.id } });
    await this.recordAudit(session.impersonatedBySuperAdminId, "impersonation.stop", {
      type: "educator",
      id: session.educator.id,
      label: session.educator.email,
    });
    return true;
  }

  // Pour le bandeau de l'appli : qui s'est connecté en tant que cet éducateur, `null` pour une session normale.
  async impersonationOf(sessionToken: string): Promise<{ superAdminEmail: string } | null> {
    const session = await this.prisma.session.findFirst({
      where: { tokenHash: hashSessionToken(sessionToken), impersonatedBySuperAdminId: { not: null }, expiresAt: { gt: this.now() } },
    });
    if (!session?.impersonatedBySuperAdminId) {
      return null;
    }
    const admin = await this.prisma.superAdmin.findUnique({ where: { id: session.impersonatedBySuperAdminId } });
    return admin ? { superAdminEmail: admin.email } : null;
  }
}
