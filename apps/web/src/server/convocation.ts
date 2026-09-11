import { EducatorNotFoundError, MatchNotFoundError, TrainingSessionNotFoundError, ValidationError } from "@evolyfoot/database";
import type { PublicEducator } from "./auth";

export interface ConvocationGateway {
  sendForMatch(educatorId: string, matchId: string): Promise<{ sentCount: number }>;
  sendForTrainingSession(educatorId: string, sessionId: string): Promise<{ sentCount: number }>;
}

function errorResponse(error: unknown, log: (error: unknown) => void): Response {
  if (error instanceof MatchNotFoundError || error instanceof TrainingSessionNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof EducatorNotFoundError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

// Envoie la convocation (via la messagerie, voir ConvocationService côté base) pour un match --
// à la composition retenue -- ou une séance -- à tout l'effectif, celle-ci n'ayant pas de
// composition.
export function createSendMatchConvocationHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  convocation: Pick<ConvocationGateway, "sendForMatch">,
  log: (error: unknown) => void,
): (request: Request, matchId: string) => Promise<Response> {
  return async (request, matchId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json(await convocation.sendForMatch(educator.id, matchId));
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createSendTrainingSessionConvocationHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  convocation: Pick<ConvocationGateway, "sendForTrainingSession">,
  log: (error: unknown) => void,
): (request: Request, sessionId: string) => Promise<Response> {
  return async (request, sessionId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json(await convocation.sendForTrainingSession(educator.id, sessionId));
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export async function createConvocationGateway(): Promise<{ gateway: ConvocationGateway; disconnect: () => Promise<void> }> {
  const {
    createDatabaseClient,
    ConvocationService,
    PrismaEducatorRepository,
    PrismaMatchRepository,
    PrismaMessageRepository,
    PrismaPlayerRepository,
    PrismaTrainingSessionRepository,
  } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new ConvocationService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaPlayerRepository(database.prisma),
    new PrismaMatchRepository(database.prisma),
    new PrismaTrainingSessionRepository(database.prisma),
    new PrismaMessageRepository(database.prisma),
  );

  return {
    gateway: {
      sendForMatch: (educatorId, matchId) => service.sendForMatch(educatorId, matchId),
      sendForTrainingSession: (educatorId, sessionId) => service.sendForTrainingSession(educatorId, sessionId),
    },
    disconnect: database.disconnect,
  };
}
