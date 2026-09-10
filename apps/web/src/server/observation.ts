import { EducatorNotFoundError, ObservationNotFoundError } from "@evolyfoot/database";
import { diagnosticCriteria, type ObservationDraft, type ObservationReport } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";

// Étend ObservationReport (le résultat d'une sauvegarde) avec ce qui n'existe qu'une fois
// l'observation persistée : identifiant réel, éventuel match d'origine, horodatage -- nécessaire
// pour lister et afficher le détail d'observations passées (voir /observations).
export interface ObservationRecord extends ObservationReport {
  matchId?: string;
  createdAt: string;
}

export interface ObservationGateway {
  save(educatorId: string, draft: ObservationDraft, matchId?: string): Promise<ObservationReport>;
  list(educatorId: string): Promise<ObservationRecord[]>;
  get(educatorId: string, observationId: string): Promise<ObservationRecord>;
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
    // Rattache l'observation au match préparé qu'elle concerne, quand elle en vient -- optionnel,
    // une observation de séance n'a pas de matchId. L'appartenance réelle du match à cet
    // éducateur (pas juste son existence) est vérifiée par la passerelle elle-même ci-dessous,
    // avant d'accepter cet identifiant -- la contrainte de clé étrangère en base garantit
    // seulement qu'un match avec cet id existe, jamais qu'il appartient à qui l'invoque.
    const matchId = typeof body.matchId === "string" ? body.matchId : undefined;

    try {
      const report = await observation.save(educator.id, body, matchId);
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

export function createListObservationsHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  observation: Pick<ObservationGateway, "list">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ observations: await observation.list(educator.id) });
    } catch (error) {
      if (error instanceof Error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export function createGetObservationHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  observation: Pick<ObservationGateway, "get">,
  log: (error: unknown) => void,
): (request: Request, observationId: string) => Promise<Response> {
  return async (request, observationId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ observation: await observation.get(educator.id, observationId) });
    } catch (error) {
      if (error instanceof ObservationNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      if (error instanceof Error) {
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
  const {
    createDatabaseClient,
    MatchNotFoundError,
    MatchService,
    ObservationService,
    PrismaEducatorRepository,
    PrismaMatchRepository,
    PrismaObservationRepository,
  } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const educatorRepository = new PrismaEducatorRepository(database.prisma);
  const service = new ObservationService(educatorRepository, new PrismaObservationRepository(database.prisma));
  const matchService = new MatchService(educatorRepository, new PrismaMatchRepository(database.prisma));

  function toRecord(observation: Awaited<ReturnType<typeof service.get>>): ObservationRecord {
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
      ...(observation.matchId ? { matchId: observation.matchId } : {}),
      createdAt: observation.createdAt.toISOString(),
    };
  }

  return {
    gateway: {
      async list(educatorId) {
        const observations = await service.list(educatorId);
        return observations.map(toRecord);
      },
      async get(educatorId, observationId) {
        return toRecord(await service.get(educatorId, observationId));
      },
      async save(educatorId, draft, matchId) {
        if (matchId) {
          // Vérifie l'appartenance réelle avant d'accepter cet identifiant : `MatchService.get`
          // lève `MatchNotFoundError` aussi bien pour un match inexistant que pour un match
          // appartenant à un autre éducateur (voir match-service.ts) -- jamais distinguer les
          // deux côté réponse HTTP, ce serait révéler l'existence d'un match d'autrui.
          try {
            await matchService.get(educatorId, matchId);
          } catch (error) {
            if (error instanceof MatchNotFoundError) {
              throw new Error("Match introuvable.");
            }
            throw error;
          }
        }
        const observation = await service.save(educatorId, draft, matchId);
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
