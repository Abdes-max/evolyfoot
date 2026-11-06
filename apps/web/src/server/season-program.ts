import { EducatorNotFoundError } from "@evolyfoot/database";
import type { DevelopmentTheme, TrainingSlotSchedule } from "@evolyfoot/domain";
import type { PublicEducator } from "./auth";

export interface SeasonProgramView {
  priorities: DevelopmentTheme[];
  // Lundi de la première semaine de la saison guidée, au format AAAA-MM-JJ.
  startDate: string;
  // Créneaux récurrents : heure et lieu de chaque jour d'entraînement.
  schedule: TrainingSlotSchedule[];
}

export interface SeasonProgramGateway {
  get(educatorId: string): Promise<SeasonProgramView | null>;
  save(educatorId: string, priorities: unknown, schedule?: unknown): Promise<SeasonProgramView>;
  saveSchedule(educatorId: string, schedule: unknown): Promise<SeasonProgramView>;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function createGetSeasonProgramHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  seasonProgram: Pick<SeasonProgramGateway, "get">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      return Response.json({ program: await seasonProgram.get(educator.id) });
    } catch (error) {
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export function createSaveSeasonProgramHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  seasonProgram: Pick<SeasonProgramGateway, "save">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await readJsonBody(request);
    try {
      return Response.json({ program: await seasonProgram.save(educator.id, body?.priorities, body?.schedule) });
    } catch (error) {
      if (error instanceof EducatorNotFoundError) {
        return Response.json({ error: error.message }, { status: 401 });
      }
      if (error instanceof Error) {
        // validateSeasonPriorities échoue avec une Error générique et un message pour le coach.
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

// PUT { schedule: [{ day, time, location }] } : créneaux récurrents de la saison ; les séances à
// venir déjà préparées suivent le nouveau réglage (voir SeasonProgramService.saveSchedule).
export function createSaveSeasonScheduleHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  seasonProgram: Pick<SeasonProgramGateway, "saveSchedule">,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await readJsonBody(request);
    try {
      return Response.json({ program: await seasonProgram.saveSchedule(educator.id, body?.schedule) });
    } catch (error) {
      if (error instanceof Error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function createSeasonProgramGateway(): Promise<{
  gateway: SeasonProgramGateway;
  disconnect: () => Promise<void>;
}> {
  const {
    createDatabaseClient,
    SeasonProgramService,
    PrismaEducatorRepository,
    PrismaSeasonProgramRepository,
    PrismaTeamRepository,
    PrismaTrainingSessionRepository,
  } = await import("@evolyfoot/database");
  const { mondayOf } = await import("@evolyfoot/domain");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new SeasonProgramService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaSeasonProgramRepository(database.prisma),
    new PrismaTrainingSessionRepository(database.prisma),
    new PrismaTeamRepository(database.prisma),
  );
  const view = (program: Awaited<ReturnType<typeof service.save>>): SeasonProgramView => ({
    priorities: program.priorities,
    startDate: isoDate(program.startDate),
    schedule: program.schedule,
  });

  return {
    gateway: {
      async get(educatorId) {
        const program = await service.get(educatorId);
        return program && view(program);
      },
      async saveSchedule(educatorId, schedule) {
        return view(await service.saveSchedule(educatorId, schedule));
      },
      async save(educatorId, priorities, schedule) {
        // Date seule (colonne DATE) : le lundi de la semaine en cours, calculé en UTC.
        const monday = mondayOf(new Date());
        const program = await service.save(educatorId, priorities, new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate())), schedule);
        return view(program);
      },
    },
    disconnect: database.disconnect,
  };
}
