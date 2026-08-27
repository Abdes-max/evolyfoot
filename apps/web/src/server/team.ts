import { EducatorNotFoundError } from "@evolyfoot/database";
import type { TeamProfile } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";

export interface TeamGateway {
  get(educatorId: string): Promise<TeamProfile | null>;
  save(educatorId: string, profile: TeamProfile): Promise<TeamProfile>;
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
      if (error instanceof Error) {
        // La validation métier (createTeamProfile) échoue avec une Error générique.
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export async function createTeamGateway(): Promise<{ gateway: TeamGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, TeamProfileService, PrismaEducatorRepository, PrismaTeamRepository, TeamNotFoundError } =
    await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new TeamProfileService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaTeamRepository(database.prisma),
  );

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
    },
    disconnect: database.disconnect,
  };
}
