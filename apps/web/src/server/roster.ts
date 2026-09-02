import { EducatorNotFoundError, PlayerNotFoundError } from "@evolyfoot/database";
import type { PublicEducator } from "./auth";

export interface RosterPlayer {
  id: string;
  name: string;
}

export interface RosterGateway {
  list(educatorId: string): Promise<RosterPlayer[]>;
  add(educatorId: string, name: string): Promise<RosterPlayer>;
  rename(educatorId: string, playerId: string, name: string): Promise<RosterPlayer>;
  remove(educatorId: string, playerId: string): Promise<void>;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readName(body: Record<string, unknown> | null): string | null {
  return body && typeof body.name === "string" ? body.name : null;
}

export function createListRosterHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  roster: Pick<RosterGateway, "list">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    try {
      const players = await roster.list(educator.id);
      return Response.json({ players });
    } catch (error) {
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export function createAddPlayerHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  roster: Pick<RosterGateway, "add">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    const name = readName(await readJsonBody(request));
    if (name === null) {
      return Response.json({ error: "Un prénom est requis." }, { status: 400 });
    }

    try {
      const player = await roster.add(educator.id, name);
      return Response.json({ player }, { status: 201 });
    } catch (error) {
      if (error instanceof EducatorNotFoundError) {
        return Response.json({ error: error.message }, { status: 401 });
      }
      if (error instanceof Error) {
        // La validation métier (prénom vide) échoue avec une Error générique.
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export function createRenamePlayerHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  roster: Pick<RosterGateway, "rename">,
  log: (error: unknown) => void,
): (request: Request, playerId: string) => Promise<Response> {
  return async (request, playerId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    const name = readName(await readJsonBody(request));
    if (name === null) {
      return Response.json({ error: "Un prénom est requis." }, { status: 400 });
    }

    try {
      const player = await roster.rename(educator.id, playerId, name);
      return Response.json({ player });
    } catch (error) {
      if (error instanceof PlayerNotFoundError) {
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

export function createRemovePlayerHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  roster: Pick<RosterGateway, "remove">,
  log: (error: unknown) => void,
): (request: Request, playerId: string) => Promise<Response> {
  return async (request, playerId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    try {
      await roster.remove(educator.id, playerId);
      return Response.json({ status: "ok" });
    } catch (error) {
      if (error instanceof PlayerNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export async function createRosterGateway(): Promise<{ gateway: RosterGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, RosterService, PrismaEducatorRepository, PrismaPlayerRepository } = await import(
    "@evolyfoot/database"
  );
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new RosterService(new PrismaEducatorRepository(database.prisma), new PrismaPlayerRepository(database.prisma));

  return {
    gateway: {
      async list(educatorId) {
        const players = await service.list(educatorId);
        return players.map((player) => ({ id: player.id, name: player.name }));
      },
      async add(educatorId, name) {
        const player = await service.add(educatorId, name);
        return { id: player.id, name: player.name };
      },
      async rename(educatorId, playerId, name) {
        const player = await service.rename(educatorId, playerId, name);
        return { id: player.id, name: player.name };
      },
      remove(educatorId, playerId) {
        return service.remove(educatorId, playerId);
      },
    },
    disconnect: database.disconnect,
  };
}
