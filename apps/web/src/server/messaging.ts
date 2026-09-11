import { EducatorNotFoundError, PlayerNotFoundError, ValidationError } from "@evolyfoot/database";
import type { MessageAuthorRole } from "@evolyfoot/domain";
import type { PublicAccount, PublicEducator } from "./auth";

export interface MessageSummary {
  id: string;
  authorRole: MessageAuthorRole;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface MessagingGateway {
  listForCoach(educatorId: string, playerId: string): Promise<MessageSummary[]>;
  sendAsCoach(educatorId: string, playerId: string, text: string): Promise<MessageSummary>;
  listForPlayerAccount(playerAccountId: string): Promise<MessageSummary[]>;
  sendAsPlayerAccount(playerAccountId: string, text: string): Promise<MessageSummary>;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function errorResponse(error: unknown, log: (error: unknown) => void): Response {
  if (error instanceof PlayerNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof EducatorNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

// Coach : lit/écrit le fil d'un joueur précis de son effectif (voir /equipe/:id côté UI).
export function createListCoachMessagesHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  messaging: Pick<MessagingGateway, "listForCoach">,
  log: (error: unknown) => void,
): (request: Request, playerId: string) => Promise<Response> {
  return async (request, playerId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ messages: await messaging.listForCoach(educator.id, playerId) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createSendCoachMessageHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  messaging: Pick<MessagingGateway, "sendAsCoach">,
  log: (error: unknown) => void,
): (request: Request, playerId: string) => Promise<Response> {
  return async (request, playerId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await readJsonBody(request);
    const text = typeof body?.text === "string" ? body.text : null;
    if (!text) {
      return Response.json({ error: "Le message est requis." }, { status: 400 });
    }
    try {
      return Response.json({ message: await messaging.sendAsCoach(educator.id, playerId, text) }, { status: 201 });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

// Joueur/tuteur : lit/écrit son propre fil, résolu via son compte (jamais un id fourni par le
// client), même principe que PlayerRsvpService.
export function createListPlayerMessagesHandler(
  resolvePlayerAccount: (request: Request) => Promise<PublicAccount | null>,
  messaging: Pick<MessagingGateway, "listForPlayerAccount">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const account = await resolvePlayerAccount(request);
    if (!account) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ messages: await messaging.listForPlayerAccount(account.id) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createSendPlayerMessageHandler(
  resolvePlayerAccount: (request: Request) => Promise<PublicAccount | null>,
  messaging: Pick<MessagingGateway, "sendAsPlayerAccount">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const account = await resolvePlayerAccount(request);
    if (!account) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await readJsonBody(request);
    const text = typeof body?.text === "string" ? body.text : null;
    if (!text) {
      return Response.json({ error: "Le message est requis." }, { status: 400 });
    }
    try {
      return Response.json({ message: await messaging.sendAsPlayerAccount(account.id, text) }, { status: 201 });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export async function createMessagingGateway(): Promise<{ gateway: MessagingGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, MessagingService, PrismaEducatorRepository, PrismaMessageRepository, PrismaPlayerRepository } =
    await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new MessagingService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaPlayerRepository(database.prisma),
    new PrismaMessageRepository(database.prisma),
  );

  const toSummary = (message: Awaited<ReturnType<typeof service.sendAsCoach>>): MessageSummary => ({
    id: message.id,
    authorRole: message.authorRole,
    authorName: message.authorName,
    text: message.text,
    createdAt: message.createdAt.toISOString(),
  });

  return {
    gateway: {
      async listForCoach(educatorId, playerId) {
        return (await service.listForCoach(educatorId, playerId)).map(toSummary);
      },
      async sendAsCoach(educatorId, playerId, text) {
        return toSummary(await service.sendAsCoach(educatorId, playerId, text));
      },
      async listForPlayerAccount(playerAccountId) {
        return (await service.listForPlayerAccount(playerAccountId)).map(toSummary);
      },
      async sendAsPlayerAccount(playerAccountId, text) {
        return toSummary(await service.sendAsPlayerAccount(playerAccountId, text));
      },
    },
    disconnect: database.disconnect,
  };
}
