import { EducatorNotFoundError } from "@evolyfoot/database";
import { ageGroups, type AgeGroup, type DevelopmentTheme } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";

export interface TrainingSessionBlockInput {
  id: string;
  activityId: string;
  durationMinutes: number;
}

export interface TrainingSessionInput {
  title: string;
  ageGroup: AgeGroup;
  playerCount: number;
  theme: DevelopmentTheme;
  intention: string;
  blocks: readonly TrainingSessionBlockInput[];
}

export interface PersistedTrainingSession extends TrainingSessionInput {
  id: string;
  createdAt: string;
}

export interface TrainingSessionGateway {
  save(educatorId: string, input: TrainingSessionInput): Promise<PersistedTrainingSession>;
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
    value.blocks.every(isBlockShaped)
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

  return {
    gateway: {
      async save(educatorId, input) {
        const session = await service.save(educatorId, input);
        return {
          id: session.id,
          title: session.title,
          ageGroup: session.ageGroup,
          playerCount: session.playerCount,
          theme: session.theme,
          intention: session.intention,
          blocks: session.blocks,
          createdAt: session.createdAt.toISOString(),
        };
      },
    },
    disconnect: database.disconnect,
  };
}
