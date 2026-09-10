import { EducatorNotFoundError, InvalidCredentialsError, ValidationError } from "@evolyfoot/database";
import type { EducatorProfileInput } from "@evolyfoot/database";
import type { PublicEducator } from "./auth";

export interface ProfileSummary {
  id: string;
  email: string;
  displayName: string;
  birthDate: string | null;
  club: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
  diploma: string | null;
  seasonFormat: string | null;
  createdAt: string;
}

export interface ProfileGateway {
  get(educatorId: string): Promise<ProfileSummary>;
  update(educatorId: string, input: EducatorProfileInput): Promise<ProfileSummary>;
  changePassword(educatorId: string, currentPassword: string, newPassword: string): Promise<void>;
}

// Champs texte optionnels de la fiche : présents dans le corps => `string | null` accepté (null
// efface), absents => on n'y touche pas.
const optionalFields = ["birthDate", "club", "country", "address", "phone", "diploma", "seasonFormat"] as const;

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function errorResponse(error: unknown, log: (error: unknown) => void): Response {
  if (error instanceof EducatorNotFoundError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof InvalidCredentialsError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof Error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

// `null` explicite ou chaîne => valeur retenue ; autre type => 400 ; clé absente => non touchée.
function readProfileInput(body: Record<string, unknown>): EducatorProfileInput | null {
  const input: EducatorProfileInput = {};

  if ("displayName" in body) {
    if (typeof body.displayName !== "string") {
      return null;
    }
    input.displayName = body.displayName;
  }

  for (const field of optionalFields) {
    if (!(field in body)) {
      continue;
    }
    const value = body[field];
    if (value !== null && typeof value !== "string") {
      return null;
    }
    input[field] = value;
  }

  return input;
}

export function createGetProfileHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  profile: Pick<ProfileGateway, "get">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ profile: await profile.get(educator.id) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createUpdateProfileHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  profile: Pick<ProfileGateway, "update">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await readJsonBody(request);
    if (!body) {
      return Response.json({ error: "Requête invalide." }, { status: 400 });
    }
    const input = readProfileInput(body);
    if (!input) {
      return Response.json({ error: "Un champ du profil a un format invalide." }, { status: 400 });
    }
    try {
      return Response.json({ profile: await profile.update(educator.id, input) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createChangePasswordHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  profile: Pick<ProfileGateway, "changePassword">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await readJsonBody(request);
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : null;
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : null;
    if (currentPassword === null || newPassword === null) {
      return Response.json({ error: "Mot de passe actuel et nouveau mot de passe sont requis." }, { status: 400 });
    }
    try {
      await profile.changePassword(educator.id, currentPassword, newPassword);
      return Response.json({ status: "ok" });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export async function createProfileGateway(): Promise<{ gateway: ProfileGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, EducatorProfileService, PrismaEducatorRepository } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new EducatorProfileService(new PrismaEducatorRepository(database.prisma));

  function toSummary(profile: Awaited<ReturnType<typeof service.get>>): ProfileSummary {
    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      birthDate: profile.birthDate,
      club: profile.club,
      country: profile.country,
      address: profile.address,
      phone: profile.phone,
      diploma: profile.diploma,
      seasonFormat: profile.seasonFormat,
      createdAt: profile.createdAt.toISOString(),
    };
  }

  return {
    gateway: {
      async get(educatorId) {
        return toSummary(await service.get(educatorId));
      },
      async update(educatorId, input) {
        return toSummary(await service.update(educatorId, input));
      },
      changePassword(educatorId, currentPassword, newPassword) {
        return service.changePassword(educatorId, currentPassword, newPassword);
      },
    },
    disconnect: database.disconnect,
  };
}
