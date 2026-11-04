import { TeamSpaceNotFoundError, ValidationError, type TeamChoice } from "@evolyfoot/database";
import { readSessionToken, type PublicAccount } from "./auth";

export interface TeamSpaceGateway {
  list(account: PublicAccount, sessionToken: string): Promise<TeamChoice[]>;
  create(account: PublicAccount, sessionToken: string): Promise<{ id: string }>;
  activate(account: PublicAccount, sessionToken: string, teamId: string): Promise<void>;
  remove(account: PublicAccount, sessionToken: string, teamId: string): Promise<void>;
}

type ResolveAccount = (request: Request) => Promise<PublicAccount | null>;

function errorResponse(error: unknown, log: (error: unknown) => void): Response {
  if (error instanceof TeamSpaceNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

// Gérer ses équipes est réservé à l'éducateur titulaire : un adjoint suit l'équipe qui l'a invité.
async function requireCoach(resolveAccount: ResolveAccount, request: Request): Promise<{ account: PublicAccount; sessionToken: string } | Response> {
  const sessionToken = readSessionToken(request);
  const account = sessionToken ? await resolveAccount(request) : null;
  if (!sessionToken || !account) {
    return Response.json({ error: "Authentification requise." }, { status: 401 });
  }
  if (account.role !== "coach") {
    return Response.json({ error: "Accès réservé à l’éducateur titulaire." }, { status: 403 });
  }
  return { account, sessionToken };
}

export function createListTeamsHandler(resolveAccount: ResolveAccount, teams: Pick<TeamSpaceGateway, "list">, log: (error: unknown) => void) {
  return async (request: Request): Promise<Response> => {
    const owner = await requireCoach(resolveAccount, request);
    if (owner instanceof Response) {
      return owner;
    }
    try {
      return Response.json({ teams: await teams.list(owner.account, owner.sessionToken) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createCreateTeamHandler(resolveAccount: ResolveAccount, teams: Pick<TeamSpaceGateway, "create">, log: (error: unknown) => void) {
  return async (request: Request): Promise<Response> => {
    const owner = await requireCoach(resolveAccount, request);
    if (owner instanceof Response) {
      return owner;
    }
    try {
      return Response.json(await teams.create(owner.account, owner.sessionToken), { status: 201 });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createActivateTeamHandler(resolveAccount: ResolveAccount, teams: Pick<TeamSpaceGateway, "activate">, log: (error: unknown) => void) {
  return async (request: Request): Promise<Response> => {
    const owner = await requireCoach(resolveAccount, request);
    if (owner instanceof Response) {
      return owner;
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (typeof body?.id !== "string" || !body.id) {
      return Response.json({ error: "Équipe manquante." }, { status: 400 });
    }
    try {
      await teams.activate(owner.account, owner.sessionToken, body.id);
      return Response.json({ status: "ok" });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createRemoveTeamHandler(resolveAccount: ResolveAccount, teams: Pick<TeamSpaceGateway, "remove">, log: (error: unknown) => void) {
  return async (request: Request, teamId: string): Promise<Response> => {
    const owner = await requireCoach(resolveAccount, request);
    if (owner instanceof Response) {
      return owner;
    }
    try {
      await teams.remove(owner.account, owner.sessionToken, teamId);
      return Response.json({ status: "ok" });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export async function createTeamSpaceGateway(): Promise<{ gateway: TeamSpaceGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, TeamSpaceService, PrismaEducatorRepository, PrismaSessionRepository, PrismaTeamRepository, PrismaTeamSpaceRepository } =
    await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new TeamSpaceService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaTeamSpaceRepository(database.prisma),
    new PrismaTeamRepository(database.prisma),
    new PrismaSessionRepository(database.prisma),
  );

  return {
    gateway: {
      list: (account, sessionToken) => service.list(account, sessionToken),
      create: (account, sessionToken) => service.create(account, sessionToken),
      activate: (account, sessionToken, teamId) => service.activate(account, sessionToken, teamId),
      remove: (account, sessionToken, teamId) => service.remove(account, sessionToken, teamId),
    },
    disconnect: database.disconnect,
  };
}
