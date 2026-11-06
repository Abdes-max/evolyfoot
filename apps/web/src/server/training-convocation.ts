import { TeamNotFoundError, ValidationError } from "@evolyfoot/database";
import type { TrainingConvocationSettings } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";
import { convocationMailer, notifyByEmail, type ConvocationOutcome } from "./convocation";

export interface TrainingConvocationGateway {
  getSettings(educatorId: string): Promise<TrainingConvocationSettings>;
  saveSettings(educatorId: string, input: { leadDays: unknown; attendanceDefault: unknown; playerIds?: unknown }): Promise<TrainingConvocationSettings>;
}

// GET : réglage des convocations aux entraînements (`attendanceDefault` null = pas encore choisi).
export function createGetConvocationSettingsHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  gateway: Pick<TrainingConvocationGateway, "getSettings">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ settings: await gateway.getSettings(educator.id) });
    } catch (error) {
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

// PUT { leadDays: 0|1|2|3|7|null, attendanceDefault: "present"|"ask", playerIds?: string[]|null }
// (joueurs des entraînements, absent = inchangé).
export function createSaveConvocationSettingsHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  gateway: Pick<TrainingConvocationGateway, "saveSettings">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    try {
      return Response.json({
        settings: await gateway.saveSettings(educator.id, { leadDays: body?.leadDays, attendanceDefault: body?.attendanceDefault, playerIds: body?.playerIds }),
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      if (error instanceof TeamNotFoundError) {
        return Response.json({ error: "Crée d’abord ton équipe." }, { status: 404 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export async function createTrainingConvocationGateway(): Promise<{ gateway: TrainingConvocationGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, PrismaPlayerRepository, PrismaTrainingConvocationRepository, TrainingConvocationService } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  // Le réglage n'envoie rien : pas besoin du service de convocation ici.
  const service = new TrainingConvocationService(
    new PrismaTrainingConvocationRepository(database.prisma),
    { sendForTrainingSession: () => Promise.reject(new Error("Non utilisé")) },
    new PrismaPlayerRepository(database.prisma),
  );
  return {
    gateway: {
      getSettings: (educatorId) => service.getSettings(educatorId),
      saveSettings: (educatorId, input) => service.saveSettings(educatorId, input),
    },
    disconnect: database.disconnect,
  };
}

// Passage du planificateur (voir instrumentation.ts) : envoie les convocations arrivées à
// échéance, par la messagerie (avec notification) puis en rappel par e-mail.
export async function sendDueTrainingConvocations(now: Date = new Date()): Promise<number> {
  const {
    createDatabaseClient,
    ConvocationService,
    NotifyingMessageRepository,
    PrismaEducatorRepository,
    PrismaMatchRepository,
    PrismaMessageRepository,
    PrismaPlayerRepository,
    PrismaTrainingConvocationRepository,
    PrismaTrainingSessionRepository,
    TrainingConvocationService,
  } = await import("@evolyfoot/database");
  const { notificationServiceFor } = await import("./notifications");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  try {
    const educators = new PrismaEducatorRepository(database.prisma);
    const repository = new PrismaTrainingConvocationRepository(database.prisma);
    const convocation = new ConvocationService(
      educators,
      new PrismaPlayerRepository(database.prisma),
      new PrismaMatchRepository(database.prisma),
      new PrismaTrainingSessionRepository(database.prisma),
      new NotifyingMessageRepository(new PrismaMessageRepository(database.prisma), await notificationServiceFor(database), console.error),
      repository,
    );
    const sent = await new TrainingConvocationService(repository, convocation).sendDue(now, console.error);
    // Hors requête : le lien du calendrier part de APP_URL (voir resolveOrigin).
    const request = new Request(process.env.APP_URL?.trim() || "http://localhost:3000");
    for (const item of sent) {
      const coach = await educators.findById(item.educatorId);
      await notifyByEmail(item.outcome as ConvocationOutcome, coach?.displayName ?? "Ton éducateur", request, convocationMailer).catch(console.error);
    }
    return sent.length;
  } finally {
    await database.disconnect();
  }
}
