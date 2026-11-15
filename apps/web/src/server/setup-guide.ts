import type { SetupGuide } from "@evolyfoot/database";
import { databaseErrorResponse } from "./api-errors";
import type { PublicAccount } from "./auth";

export interface SetupGuideGateway {
  get(accountId: string, teamId: string): Promise<SetupGuide>;
  setDismissed(accountId: string, dismissed: boolean): Promise<void>;
}

// Le guide ne concerne que les coachs : `resolveAccount` est le compte connecté (fermeture du guide),
// `resolveTeam` l'équipe active dont on mesure l'avancement.
interface Resolvers {
  resolveAccount: (request: Request) => Promise<PublicAccount | null>;
  resolveTeam: (request: Request) => Promise<{ id: string } | null>;
}

function errorResponse(error: unknown, log: (error: unknown) => void): Response {
  const databaseResponse = databaseErrorResponse(error, log);
  if (databaseResponse) {
    return databaseResponse;
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

type CoachContext = { response: Response; account?: undefined; team?: undefined } | { response?: undefined; account: PublicAccount; team: { id: string } };

async function coachOnly(request: Request, { resolveAccount, resolveTeam }: Resolvers): Promise<CoachContext> {
  const account = await resolveAccount(request);
  if (!account) {
    return { response: Response.json({ error: "Authentification requise." }, { status: 401 }) };
  }
  if (account.role !== "coach") {
    return { response: Response.json({ error: "Réservé aux éducateurs." }, { status: 403 }) };
  }
  const team = await resolveTeam(request);
  return { account, team: team ?? account };
}

export function createGetSetupGuideHandler(
  resolvers: Resolvers,
  gateway: Pick<SetupGuideGateway, "get">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const context = await coachOnly(request, resolvers);
      if (context.response) {
        return context.response;
      }
      return Response.json({ guide: await gateway.get(context.account.id, context.team.id) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createDismissSetupGuideHandler(
  resolvers: Resolvers,
  gateway: Pick<SetupGuideGateway, "setDismissed">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const context = await coachOnly(request, resolvers);
      if (context.response) {
        return context.response;
      }
      const body = (await request.json().catch(() => ({}))) as { dismissed?: unknown };
      await gateway.setDismissed(context.account.id, body.dismissed !== false);
      return Response.json({ status: "ok" });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export async function createSetupGuideGateway(): Promise<{ gateway: SetupGuideGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, SetupGuideService } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  return { gateway: new SetupGuideService(database.prisma), disconnect: database.disconnect };
}
