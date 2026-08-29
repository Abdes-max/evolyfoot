import { EducatorNotFoundError } from "@evolyfoot/database";
import { diagnosticCriteria, type ObservationDraft, type ObservationReport } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";

export interface ObservationGateway {
  save(educatorId: string, draft: ObservationDraft): Promise<ObservationReport>;
}

const observationLevels = ["reinforce", "progress", "achieved"] as const;
const observationEventTypes = ["training", "match"] as const;
const criterionIds = diagnosticCriteria.map((criterion) => criterion.id);

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isPlayerReferenceShaped(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const player = value as Record<string, unknown>;
  return typeof player.id === "string" && typeof player.name === "string";
}

function isRatingShaped(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const rating = value as Record<string, unknown>;
  return (
    typeof rating.criterion === "string" &&
    criterionIds.includes(rating.criterion as (typeof criterionIds)[number]) &&
    typeof rating.level === "string" &&
    (observationLevels as readonly string[]).includes(rating.level)
  );
}

function isSignalShaped(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const signal = value as Record<string, unknown>;
  return (
    typeof signal.playerId === "string" &&
    typeof signal.playerName === "string" &&
    (signal.kind === "highlight" || signal.kind === "support")
  );
}

function isObservationDraftShaped(value: Record<string, unknown> | null): value is Record<string, unknown> & ObservationDraft {
  if (!value) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.eventType === "string" &&
    (observationEventTypes as readonly string[]).includes(value.eventType) &&
    typeof value.title === "string" &&
    typeof value.dateLabel === "string" &&
    Array.isArray(value.players) &&
    value.players.every(isPlayerReferenceShaped) &&
    Array.isArray(value.ratings) &&
    value.ratings.every(isRatingShaped) &&
    Array.isArray(value.signals) &&
    value.signals.every(isSignalShaped) &&
    (value.note === undefined || typeof value.note === "string")
  );
}

export function createSaveObservationHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  observation: Pick<ObservationGateway, "save">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await readJsonBody(request);
    if (!isObservationDraftShaped(body)) {
      return Response.json({ error: "L’observation est incomplète." }, { status: 400 });
    }

    try {
      const report = await observation.save(educator.id, body);
      return Response.json({ report }, { status: 201 });
    } catch (error) {
      if (error instanceof EducatorNotFoundError) {
        return Response.json({ error: error.message }, { status: 401 });
      }
      if (error instanceof Error) {
        // La validation métier (completeObservation) échoue avec une Error générique.
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export async function createObservationGateway(): Promise<{
  gateway: ObservationGateway;
  disconnect: () => Promise<void>;
}> {
  const { createDatabaseClient, ObservationService, PrismaEducatorRepository, PrismaObservationRepository } =
    await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new ObservationService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaObservationRepository(database.prisma),
  );

  return {
    gateway: {
      async save(educatorId, draft) {
        const observation = await service.save(educatorId, draft);
        return {
          id: observation.id,
          eventType: observation.eventType,
          title: observation.title,
          dateLabel: observation.dateLabel,
          players: observation.players,
          ratings: observation.ratings,
          signals: observation.signals,
          ...(observation.note ? { note: observation.note } : {}),
          summary: observation.summary,
        };
      },
    },
    disconnect: database.disconnect,
  };
}
