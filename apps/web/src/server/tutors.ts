import { PlayerNotFoundError, ValidationError } from "@evolyfoot/database";
import type { PlayerTutors } from "@evolyfoot/database";
import type { PublicEducator } from "./auth";

export interface TutorsGateway {
  list(educatorId: string, playerId: string): Promise<PlayerTutors>;
  answer(educatorId: string, playerId: string, requestId: string, accept: boolean): Promise<PlayerTutors>;
  remove(educatorId: string, playerId: string, accountId: string): Promise<PlayerTutors>;
}

function errorResponse(error: unknown, log: (error: unknown) => void): Response {
  if (error instanceof PlayerNotFoundError) {
    return Response.json({ error: "Joueur introuvable." }, { status: 404 });
  }
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

// Tuteurs d'un joueur côté éducateur : liste (GET), réponse à une demande (POST { requestId,
// accept }), retrait d'un tuteur (DELETE { accountId }).
export function createTutorsHandlers(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  tutors: TutorsGateway,
  log: (error: unknown) => void,
) {
  async function guard(request: Request, run: (educator: PublicEducator) => Promise<PlayerTutors>): Promise<Response> {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json(await run(educator));
    } catch (error) {
      return errorResponse(error, log);
    }
  }

  async function readBody(request: Request): Promise<Record<string, unknown>> {
    const body: unknown = await request.json().catch(() => null);
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  }

  return {
    list: (request: Request, playerId: string) => guard(request, (educator) => tutors.list(educator.id, playerId)),
    answer: (request: Request, playerId: string) =>
      guard(request, async (educator) => {
        const body = await readBody(request);
        if (typeof body.requestId !== "string" || typeof body.accept !== "boolean") {
          throw new ValidationError("Demande et réponse requises.");
        }
        return tutors.answer(educator.id, playerId, body.requestId, body.accept);
      }),
    remove: (request: Request, playerId: string) =>
      guard(request, async (educator) => {
        const body = await readBody(request);
        if (typeof body.accountId !== "string") {
          throw new ValidationError("Tuteur manquant.");
        }
        return tutors.remove(educator.id, playerId, body.accountId);
      }),
  };
}

export async function createTutorsGateway(): Promise<{ gateway: TutorsGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, PrismaEducatorRepository, PrismaPlayerRepository, TutorService } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const educators = new PrismaEducatorRepository(database.prisma);
  const service = new TutorService(educators, new PrismaPlayerRepository(database.prisma), educators);
  return {
    gateway: {
      list: (educatorId, playerId) => service.list(educatorId, playerId),
      answer: (educatorId, playerId, requestId, accept) => service.answer(educatorId, playerId, requestId, accept),
      remove: (educatorId, playerId, accountId) => service.remove(educatorId, playerId, accountId),
    },
    disconnect: database.disconnect,
  };
}
