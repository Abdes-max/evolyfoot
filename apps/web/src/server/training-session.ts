import { EducatorNotFoundError } from "@evolyfoot/database";
import { ageGroups, type AgeGroup, type AttendanceEntry, type DevelopmentTheme } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";

export interface TrainingSessionBlockInput {
  id: string;
  activityId: string;
  durationMinutes: number;
}

// Cycle du plan de progression : 4 semaines (aligné sur trainingCycleWeekCount côté base).
const cycleWeekCount = 4;

export interface TrainingSessionInput {
  title: string;
  ageGroup: AgeGroup;
  playerCount: number;
  theme: DevelopmentTheme;
  intention: string;
  blocks: readonly TrainingSessionBlockInput[];
  weekNumber: number;
  slot: number;
  attendance?: readonly AttendanceEntry[];
}

export interface PersistedTrainingSession extends TrainingSessionInput {
  id: string;
  createdAt: string;
}

export interface TrainingSessionGateway {
  save(educatorId: string, input: TrainingSessionInput): Promise<PersistedTrainingSession>;
  list(educatorId: string): Promise<PersistedTrainingSession[]>;
  getById(educatorId: string, id: string): Promise<PersistedTrainingSession | null>;
}

// Pas de constante partagée côté domaine pour les thèmes (contrairement à `ageGroups`) : on la
// duplique ici, alignée sur `DevelopmentTheme`, pour rejeter une forme invalide avant même
// d'appeler le service métier.
const developmentThemes: ReadonlyArray<DevelopmentTheme> = [
  "Conserver le ballon",
  "Progresser ensemble",
  "Finir les actions",
  "Récupérer rapidement",
];

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isBlockShaped(value: unknown): value is TrainingSessionBlockInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const block = value as Record<string, unknown>;
  return (
    typeof block.id === "string" &&
    typeof block.activityId === "string" &&
    typeof block.durationMinutes === "number"
  );
}

function isAttendanceEntryShaped(value: unknown): value is AttendanceEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return typeof entry.playerId === "string" && typeof entry.playerName === "string" && typeof entry.present === "boolean";
}

function isTrainingSessionInputShaped(
  value: Record<string, unknown> | null,
): value is Record<string, unknown> & TrainingSessionInput {
  if (!value) {
    return false;
  }
  return (
    typeof value.title === "string" &&
    typeof value.ageGroup === "string" &&
    ageGroups.includes(value.ageGroup as AgeGroup) &&
    typeof value.playerCount === "number" &&
    typeof value.theme === "string" &&
    developmentThemes.includes(value.theme as DevelopmentTheme) &&
    typeof value.intention === "string" &&
    Array.isArray(value.blocks) &&
    value.blocks.length > 0 &&
    value.blocks.every(isBlockShaped) &&
    typeof value.weekNumber === "number" &&
    Number.isInteger(value.weekNumber) &&
    value.weekNumber >= 1 &&
    value.weekNumber <= cycleWeekCount &&
    typeof value.slot === "number" &&
    Number.isInteger(value.slot) &&
    value.slot >= 0 &&
    (value.attendance === undefined || (Array.isArray(value.attendance) && value.attendance.every(isAttendanceEntryShaped)))
  );
}

export function createSaveTrainingSessionHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  trainingSession: Pick<TrainingSessionGateway, "save">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await readJsonBody(request);
    if (!isTrainingSessionInputShaped(body)) {
      return Response.json({ error: "La séance est incomplète." }, { status: 400 });
    }

    try {
      const session = await trainingSession.save(educator.id, body);
      return Response.json({ session }, { status: 201 });
    } catch (error) {
      if (error instanceof EducatorNotFoundError) {
        return Response.json({ error: error.message }, { status: 401 });
      }
      if (error instanceof Error) {
        // La validation métier (durée, activité inconnue, énumération invalide) échoue avec une
        // Error générique.
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export function createListTrainingSessionsHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  trainingSession: Pick<TrainingSessionGateway, "list">,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const sessions = await trainingSession.list(educator.id);
    return Response.json({ sessions });
  };
}

export function createGetTrainingSessionHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  trainingSession: Pick<TrainingSessionGateway, "getById">,
): (request: Request, id: string) => Promise<Response> {
  return async (request, id) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const session = await trainingSession.getById(educator.id, id);
    if (!session) {
      return Response.json({ error: "Séance introuvable." }, { status: 404 });
    }
    return Response.json({ session });
  };
}

export async function createTrainingSessionGateway(): Promise<{
  gateway: TrainingSessionGateway;
  disconnect: () => Promise<void>;
}> {
  const { createDatabaseClient, TrainingSessionService, PrismaEducatorRepository, PrismaTrainingSessionRepository } =
    await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new TrainingSessionService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaTrainingSessionRepository(database.prisma),
  );

  const toSummary = (session: Awaited<ReturnType<typeof service.save>>): PersistedTrainingSession => ({
    id: session.id,
    title: session.title,
    ageGroup: session.ageGroup,
    playerCount: session.playerCount,
    theme: session.theme,
    intention: session.intention,
    blocks: session.blocks,
    weekNumber: session.weekNumber,
    slot: session.slot,
    ...(session.attendance ? { attendance: session.attendance } : {}),
    createdAt: session.createdAt.toISOString(),
  });

  return {
    gateway: {
      async save(educatorId, input) {
        return toSummary(await service.save(educatorId, input));
      },
      async list(educatorId) {
        return (await service.list(educatorId)).map(toSummary);
      },
      async getById(educatorId, id) {
        const session = await service.getById(educatorId, id);
        return session ? toSummary(session) : null;
      },
    },
    disconnect: database.disconnect,
  };
}
