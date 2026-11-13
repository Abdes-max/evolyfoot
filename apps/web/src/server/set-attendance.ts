import { EducatorNotFoundError } from "@evolyfoot/database";
import type { PublicEducator } from "./auth";
import { databaseErrorResponse } from "./api-errors";

// Présences validées ou corrigées par l'éducateur une fois l'événement terminé (séance, match,
// tournoi, plateau) : même contrat pour les quatre, `PUT .../attendance` avec
// `{ attendance: [{ playerId, status, comment? }] }`. Les règles (événement terminé, pas annulé,
// joueurs concernés) sont dans les services de `@evolyfoot/database`.
export function createSetAttendanceHandler<Summary>(options: {
  resolveEducator: (request: Request) => Promise<PublicEducator | null>;
  setAttendance: (educatorId: string, id: string, updates: unknown) => Promise<Summary>;
  isNotFound: (error: unknown) => boolean;
  // Nom du champ de la réponse : `{ match: ... }`, `{ session: ... }`...
  key: string;
  log: (error: unknown) => void;
}): (request: Request, id: string) => Promise<Response> {
  return async (request, id) => {
    const educator = await options.resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Présences invalides." }, { status: 400 });
    }
    const updates = typeof body === "object" && body !== null ? (body as Record<string, unknown>).attendance : undefined;

    try {
      return Response.json({ [options.key]: await options.setAttendance(educator.id, id, updates) });
    } catch (error) {
      const databaseResponse = databaseErrorResponse(error, options.log);
      if (databaseResponse) {
        return databaseResponse;
      }
      if (options.isNotFound(error)) {
        return Response.json({ error: (error as Error).message }, { status: 404 });
      }
      if (error instanceof EducatorNotFoundError) {
        return Response.json({ error: error.message }, { status: 401 });
      }
      if (error instanceof Error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      options.log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}
