import { EducatorNotFoundError, ValidationError } from "@evolyfoot/database";
import type { PersonalExercise, PersonalExerciseInput } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";

export interface PersonalExerciseGateway {
  list(educatorId: string): Promise<PersonalExercise[]>;
  add(educatorId: string, input: PersonalExerciseInput): Promise<PersonalExercise>;
  remove(educatorId: string, id: string): Promise<void>;
}

type ResolveEducator = (request: Request) => Promise<PublicEducator | null>;

function unauthenticated(): Response {
  return Response.json({ error: "Authentification requise." }, { status: 401 });
}

function errorResponse(error: unknown, log: (error: unknown) => void): Response {
  if (error instanceof EducatorNotFoundError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

function readInput(body: unknown): PersonalExerciseInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const value = body as Record<string, unknown>;
  const textFields = ["kind", "theme", "title", "objective", "organization", "instruction", "observable"] as const;
  if (textFields.some((field) => typeof value[field] !== "string")) {
    return null;
  }
  if (value.photo !== null && typeof value.photo !== "string") {
    return null;
  }
  return value as unknown as PersonalExerciseInput;
}

export function createListPersonalExercisesHandler(
  resolveEducator: ResolveEducator,
  exercises: Pick<PersonalExerciseGateway, "list">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return unauthenticated();
    }
    try {
      return Response.json({ exercises: await exercises.list(educator.id) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createAddPersonalExerciseHandler(
  resolveEducator: ResolveEducator,
  exercises: Pick<PersonalExerciseGateway, "add">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return unauthenticated();
    }
    const input = readInput(await request.json().catch(() => null));
    if (!input) {
      return Response.json({ error: "La fiche de l’exercice est incomplète." }, { status: 400 });
    }
    try {
      return Response.json({ exercise: await exercises.add(educator.id, input) }, { status: 201 });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createRemovePersonalExerciseHandler(
  resolveEducator: ResolveEducator,
  exercises: Pick<PersonalExerciseGateway, "remove">,
  log: (error: unknown) => void,
): (request: Request, id: string) => Promise<Response> {
  return async (request, id) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return unauthenticated();
    }
    try {
      await exercises.remove(educator.id, id);
      return new Response(null, { status: 204 });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export async function createPersonalExerciseGateway(): Promise<{ gateway: PersonalExerciseGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, PersonalExerciseService, PrismaEducatorRepository, PrismaPersonalExerciseRepository } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new PersonalExerciseService(new PrismaEducatorRepository(database.prisma), new PrismaPersonalExerciseRepository(database.prisma));

  return {
    gateway: {
      list: (educatorId) => service.list(educatorId),
      add: (educatorId, input) => service.add(educatorId, input),
      remove: (educatorId, id) => service.remove(educatorId, id),
    },
    disconnect: database.disconnect,
  };
}
