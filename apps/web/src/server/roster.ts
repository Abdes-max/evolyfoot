import { EducatorNotFoundError, PlayerNotFoundError } from "@evolyfoot/database";
import type { PlayerDetailsInput } from "@evolyfoot/database";
import type { PublicEducator } from "./auth";

export interface RosterPlayer {
  id: string;
  firstName: string;
  lastName: string;
  // Nom complet (`${firstName} ${lastName}`.trim()) -- gardé pour tous les affichages qui n'ont
  // besoin que d'une chaîne unique (composition de match, présence, messagerie...).
  name: string;
  photo: string | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
}

// Clés de fiche joueur acceptées dans le corps d'un PATCH (hors `firstName`/`lastName`, traités à
// part -- une chaîne vide y est rejetée, contrairement aux clés ci-dessous où elle efface).
const detailKeys = ["photo", "birthDate", "phone", "email"] as const;

export interface RosterGateway {
  list(educatorId: string): Promise<RosterPlayer[]>;
  add(educatorId: string, firstName: string, lastName: string): Promise<RosterPlayer>;
  update(educatorId: string, playerId: string, input: PlayerDetailsInput): Promise<RosterPlayer>;
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

    const body = await readJsonBody(request);
    const firstName = body && typeof body.firstName === "string" ? body.firstName : null;
    const lastName = body && typeof body.lastName === "string" ? body.lastName : null;
    if (firstName === null || lastName === null) {
      return Response.json({ error: "Le prénom et le nom sont requis." }, { status: 400 });
    }

    try {
      const player = await roster.add(educator.id, firstName, lastName);
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

export function createUpdatePlayerHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  roster: Pick<RosterGateway, "update">,
  log: (error: unknown) => void,
): (request: Request, playerId: string) => Promise<Response> {
  return async (request, playerId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await readJsonBody(request);
    if (!body) {
      return Response.json({ error: "Requête invalide." }, { status: 400 });
    }
    const input: PlayerDetailsInput = {};
    if ("firstName" in body) {
      if (typeof body.firstName !== "string") {
        return Response.json({ error: "Un prénom est requis." }, { status: 400 });
      }
      input.firstName = body.firstName;
    }
    if ("lastName" in body) {
      if (typeof body.lastName !== "string") {
        return Response.json({ error: "Un nom est requis." }, { status: 400 });
      }
      input.lastName = body.lastName;
    }
    for (const key of detailKeys) {
      if (!(key in body)) {
        continue;
      }
      const value = body[key];
      if (value !== null && typeof value !== "string") {
        return Response.json({ error: `Le champ ${key} a un format invalide.` }, { status: 400 });
      }
      input[key] = value;
    }
    if (Object.keys(input).length === 0) {
      return Response.json({ error: "Aucune donnée à mettre à jour." }, { status: 400 });
    }

    try {
      const player = await roster.update(educator.id, playerId, input);
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

  const toRosterPlayer = (player: Awaited<ReturnType<typeof service.add>>): RosterPlayer => ({
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    name: player.name,
    photo: player.photo,
    birthDate: player.birthDate,
    phone: player.phone,
    email: player.email,
  });

  return {
    gateway: {
      async list(educatorId) {
        return (await service.list(educatorId)).map(toRosterPlayer);
      },
      async add(educatorId, firstName, lastName) {
        return toRosterPlayer(await service.add(educatorId, firstName, lastName));
      },
      async update(educatorId, playerId, input) {
        return toRosterPlayer(await service.updateDetails(educatorId, playerId, input));
      },
      remove(educatorId, playerId) {
        return service.remove(educatorId, playerId);
      },
    },
    disconnect: database.disconnect,
  };
}
