import { EducatorNotFoundError, InviteInvalidError, PlayerNotFoundError, ValidationError } from "@evolyfoot/database";
import type { FollowedChild } from "@evolyfoot/database";
import type { PublicAccount } from "./auth";

export interface PlayerChildrenGateway {
  list(accountId: string): Promise<FollowedChild[]>;
  select(accountId: string, playerId: string): Promise<void>;
  attachInvite(accountId: string, token: string): Promise<void>;
  setPhoto(accountId: string, photo: string | null): Promise<void>;
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
  if (error instanceof EducatorNotFoundError || error instanceof PlayerNotFoundError) {
    return Response.json({ error: "Enfant introuvable." }, { status: 404 });
  }
  if (error instanceof InviteInvalidError || error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

// Compte tuteur/joueur : liste de ses enfants suivis (GET), choix de l’enfant affiché (PUT
// { playerId }), ajout d’un enfant par une invitation reçue (POST { token }).
export function createPlayerChildrenHandlers(
  resolvePlayerAccount: (request: Request) => Promise<PublicAccount | null>,
  children: PlayerChildrenGateway,
  log: (error: unknown) => void,
) {
  async function guard(request: Request, run: (account: PublicAccount) => Promise<Response>): Promise<Response> {
    const account = await resolvePlayerAccount(request);
    if (!account) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return await run(account);
    } catch (error) {
      return errorResponse(error, log);
    }
  }

  return {
    list: (request: Request) => guard(request, async (account) => Response.json({ children: await children.list(account.id) })),
    select: (request: Request) =>
      guard(request, async (account) => {
        const body = await readJsonBody(request);
        if (typeof body?.playerId !== "string") {
          return Response.json({ error: "Enfant manquant." }, { status: 400 });
        }
        await children.select(account.id, body.playerId);
        return Response.json({ children: await children.list(account.id) });
      }),
    attach: (request: Request) =>
      guard(request, async (account) => {
        const body = await readJsonBody(request);
        if (typeof body?.token !== "string") {
          return Response.json({ error: "Invitation manquante." }, { status: 400 });
        }
        await children.attachInvite(account.id, body.token);
        return Response.json({ children: await children.list(account.id) }, { status: 201 });
      }),
    // PUT { photo: data URL | null } : photo de l’enfant affiché.
    photo: (request: Request) =>
      guard(request, async (account) => {
        const body = await readJsonBody(request);
        if (!body || !(typeof body.photo === "string" || body.photo === null)) {
          return Response.json({ error: "Photo manquante." }, { status: 400 });
        }
        await children.setPhoto(account.id, body.photo as string | null);
        return Response.json({ status: "ok" });
      }),
  };
}

export async function createPlayerChildrenGateway(): Promise<{ gateway: PlayerChildrenGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, PlayerChildrenService, PrismaEducatorRepository, PrismaPlayerInviteRepository, PrismaPlayerRepository, PrismaTeamRepository } =
    await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const educators = new PrismaEducatorRepository(database.prisma);
  const service = new PlayerChildrenService(
    educators,
    educators,
    new PrismaPlayerRepository(database.prisma),
    new PrismaTeamRepository(database.prisma),
    new PrismaPlayerInviteRepository(database.prisma),
  );
  return {
    gateway: {
      list: (accountId) => service.list(accountId),
      select: (accountId, playerId) => service.select(accountId, playerId),
      attachInvite: (accountId, token) => service.attachInvite(accountId, token),
      setPhoto: (accountId, photo) => service.setPhoto(accountId, photo),
    },
    disconnect: database.disconnect,
  };
}
