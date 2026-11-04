import { ClubNotFoundError, ValidationError, type ClubRecord, type SharedClubExercise } from "@evolyfoot/database";
import type { PublicAccount } from "./auth";

export interface ClubGateway {
  get(accountId: string): Promise<ClubRecord | null>;
  create(accountId: string, name: string): Promise<ClubRecord>;
  join(accountId: string, code: string): Promise<ClubRecord>;
  leave(accountId: string): Promise<void>;
  sharedExercises(accountId: string): Promise<SharedClubExercise[]>;
}

type ResolveAccount = (request: Request) => Promise<PublicAccount | null>;

function errorResponse(error: unknown, log: (error: unknown) => void): Response {
  if (error instanceof ClubNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

// Le club appartient au compte de l'éducateur titulaire : un adjoint travaille dans l'équipe d'un
// autre et ne rejoint pas de club en son nom.
async function requireCoach(resolveAccount: ResolveAccount, request: Request): Promise<PublicAccount | Response> {
  const account = await resolveAccount(request);
  if (!account) {
    return Response.json({ error: "Authentification requise." }, { status: 401 });
  }
  if (account.role !== "coach") {
    return Response.json({ error: "Accès réservé à l’éducateur titulaire." }, { status: 403 });
  }
  return account;
}

export function createGetClubHandler(resolveAccount: ResolveAccount, clubs: Pick<ClubGateway, "get">, log: (error: unknown) => void) {
  return async (request: Request): Promise<Response> => {
    const account = await requireCoach(resolveAccount, request);
    if (account instanceof Response) {
      return account;
    }
    try {
      return Response.json({ club: await clubs.get(account.id) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

// Corps `{ name }` pour créer un club, `{ code }` pour en rejoindre un.
export function createCreateOrJoinClubHandler(resolveAccount: ResolveAccount, clubs: Pick<ClubGateway, "create" | "join">, log: (error: unknown) => void) {
  return async (request: Request): Promise<Response> => {
    const account = await requireCoach(resolveAccount, request);
    if (account instanceof Response) {
      return account;
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    try {
      if (typeof body?.code === "string") {
        return Response.json({ club: await clubs.join(account.id, body.code) });
      }
      if (typeof body?.name === "string") {
        return Response.json({ club: await clubs.create(account.id, body.name) }, { status: 201 });
      }
      return Response.json({ error: "Indique le nom du club ou son code." }, { status: 400 });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createLeaveClubHandler(resolveAccount: ResolveAccount, clubs: Pick<ClubGateway, "leave">, log: (error: unknown) => void) {
  return async (request: Request): Promise<Response> => {
    const account = await requireCoach(resolveAccount, request);
    if (account instanceof Response) {
      return account;
    }
    try {
      await clubs.leave(account.id);
      return new Response(null, { status: 204 });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createListClubExercisesHandler(resolveAccount: ResolveAccount, clubs: Pick<ClubGateway, "sharedExercises">, log: (error: unknown) => void) {
  return async (request: Request): Promise<Response> => {
    const account = await requireCoach(resolveAccount, request);
    if (account instanceof Response) {
      return account;
    }
    try {
      return Response.json({ exercises: await clubs.sharedExercises(account.id) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export async function createClubGateway(): Promise<{ gateway: ClubGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, ClubService, PrismaClubRepository } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new ClubService(new PrismaClubRepository(database.prisma));

  return {
    gateway: {
      get: (accountId) => service.get(accountId),
      create: (accountId, name) => service.create(accountId, name),
      join: (accountId, code) => service.join(accountId, code),
      leave: (accountId) => service.leave(accountId),
      sharedExercises: (accountId) => service.sharedExercises(accountId),
    },
    disconnect: database.disconnect,
  };
}
