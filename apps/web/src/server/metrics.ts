import type { MvpMetrics } from "@evolyfoot/database";
import type { PublicEducator } from "./auth";

export type { MvpMetrics };

export interface MetricsGateway {
  get(): Promise<MvpMetrics>;
}

function isAdminEmail(email: string): boolean {
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

export function createMetricsHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  metrics: Pick<MetricsGateway, "get">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    if (!isAdminEmail(educator.email)) {
      // 403, pas 404 : ce n'est pas un secret que la route existe, seulement que son contenu
      // (des données agrégées sur l'ensemble des éducateurs) est réservé.
      return Response.json({ error: "Accès réservé." }, { status: 403 });
    }

    try {
      const data = await metrics.get();
      return Response.json(data);
    } catch (error) {
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export async function createMetricsGateway(): Promise<{
  gateway: MetricsGateway;
  disconnect: () => Promise<void>;
}> {
  const { createDatabaseClient, MetricsService } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new MetricsService(database.prisma);

  return {
    gateway: { get: () => service.get() },
    disconnect: database.disconnect,
  };
}
