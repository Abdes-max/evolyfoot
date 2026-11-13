import { EducatorNotFoundError, TeamNotFoundError, ValidationError } from "@evolyfoot/database";
import type { CompetitionLineup, TeamProfile } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";
import { databaseErrorResponse } from "./api-errors";

export interface TeamGateway {
  get(educatorId: string): Promise<TeamProfile | null>;
  save(educatorId: string, profile: TeamProfile): Promise<TeamProfile>;
  saveLogo(educatorId: string, logo: string | null): Promise<TeamProfile>;
  defaultLineup(educatorId: string): Promise<CompetitionLineup | null>;
  saveDefaultLineup(educatorId: string, lineup: unknown): Promise<CompetitionLineup | null>;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isTeamProfileShaped(value: Record<string, unknown> | null): value is Record<string, unknown> & TeamProfile {
  if (!value) {
    return false;
  }
  return (
    typeof value.name === "string" &&
    typeof value.ageGroup === "string" &&
    typeof value.playerCount === "number" &&
    typeof value.sessionsPerWeek === "number" &&
    Array.isArray(value.trainingDays) &&
    value.trainingDays.every((day) => typeof day === "string")
  );
}

export function createGetTeamHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  team: Pick<TeamGateway, "get">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    try {
      const profile = await team.get(educator.id);
      return Response.json({ profile });
    } catch (error) {
      const databaseResponse = databaseErrorResponse(error, log);
      if (databaseResponse) {
        return databaseResponse;
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export function createSaveTeamHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  team: Pick<TeamGateway, "save">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await readJsonBody(request);
    if (!isTeamProfileShaped(body)) {
      return Response.json({ error: "Le profil d’équipe est incomplet." }, { status: 400 });
    }

    try {
      const profile = await team.save(educator.id, body);
      return Response.json({ profile });
    } catch (error) {
      if (error instanceof EducatorNotFoundError) {
        return Response.json({ error: error.message }, { status: 401 });
      }
      const databaseResponse = databaseErrorResponse(error, log);
      if (databaseResponse) {
        return databaseResponse;
      }
      if (error instanceof Error) {
        // La validation métier (createTeamProfile) échoue avec une Error générique.
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

// PUT `{ logo: "data:image/…" | null }` : choisit ou retire le logo de l'équipe.
export function createSaveTeamLogoHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  team: Pick<TeamGateway, "saveLogo">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await readJsonBody(request);
    const logo = body?.logo;
    if (typeof logo !== "string" && logo !== null) {
      return Response.json({ error: "Logo manquant." }, { status: 400 });
    }
    try {
      return Response.json({ profile: await team.saveLogo(educator.id, logo) });
    } catch (error) {
      if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
      if (error instanceof TeamNotFoundError) return Response.json({ error: error.message }, { status: 404 });
      if (error instanceof EducatorNotFoundError) return Response.json({ error: error.message }, { status: 401 });
      const databaseResponse = databaseErrorResponse(error, log);
      if (databaseResponse) {
        return databaseResponse;
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

// GET : compo type de l'équipe (indépendante des matchs) ; PUT `{ lineup }` (null pour la retirer).
export function createTeamLineupHandlers(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  team: Pick<TeamGateway, "defaultLineup" | "saveDefaultLineup">,
  log: (error: unknown) => void,
) {
  async function guard(request: Request, run: (educator: PublicEducator) => Promise<CompetitionLineup | null>): Promise<Response> {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ lineup: await run(educator) });
    } catch (error) {
      if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
      if (error instanceof TeamNotFoundError) return Response.json({ error: "Crée d’abord ton équipe." }, { status: 404 });
      const databaseResponse = databaseErrorResponse(error, log);
      if (databaseResponse) {
        return databaseResponse;
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  }
  return {
    get: (request: Request) => guard(request, (educator) => team.defaultLineup(educator.id)),
    save: (request: Request) =>
      guard(request, async (educator) => {
        const body = await readJsonBody(request);
        if (!body || !("lineup" in body)) throw new ValidationError("Composition manquante.");
        return team.saveDefaultLineup(educator.id, body.lineup);
      }),
  };
}

export async function createTeamGateway(): Promise<{ gateway: TeamGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, TeamProfileService, PrismaEducatorRepository, PrismaPlayerRepository, PrismaTeamRepository, TeamNotFoundError } =
    await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new TeamProfileService(new PrismaEducatorRepository(database.prisma), new PrismaTeamRepository(database.prisma));

  return {
    gateway: {
      async get(educatorId) {
        try {
          const team = await service.get(educatorId);
          return team.profile;
        } catch (error) {
          if (error instanceof TeamNotFoundError) {
            return null;
          }
          throw error;
        }
      },
      async save(educatorId, profile) {
        const team = await service.save(educatorId, profile);
        return team.profile;
      },
      async saveLogo(educatorId, logo) {
        const team = await service.saveLogo(educatorId, logo);
        return team.profile;
      },
      defaultLineup: (educatorId) => service.defaultLineup(educatorId),
      async saveDefaultLineup(educatorId, lineup) {
        const players = await new PrismaPlayerRepository(database.prisma).listByEducator(educatorId);
        return service.saveDefaultLineup(educatorId, lineup, new Map(players.map((player) => [player.id, player.name])));
      },
    },
    disconnect: database.disconnect,
  };
}
