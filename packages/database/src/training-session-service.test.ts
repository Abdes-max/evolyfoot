import { generateTrainingSession } from "@evolyfoot/domain";
import { describe, expect, it } from "vitest";
import { TrainingSessionService, type TrainingSessionInput } from "./training-session-service";
import { EducatorNotFoundError, ValidationError } from "./errors";
import type {
  EducatorRecord,
  EducatorRepository,
  PersistedTrainingSession,
  PersistedTrainingSessionBlock,
  TrainingSessionRepository,
} from "./repositories";

// Séance réelle du domaine (75 min, valide) réduite à la forme envoyée par le client -- évite
// d'inventer des identifiants d'activité à la main.
const demoWeek = {
  week: 1,
  phase: "Découvrir" as const,
  theme: "Récupérer rapidement" as const,
  intention: "Provoquer des pertes de balle pour s’entraîner à réagir vite.",
  observable: "Les joueurs identifient le moment de la perte.",
};
const generated = generateTrainingSession(demoWeek, "U12", 14);
const validInput: TrainingSessionInput = {
  title: generated.title,
  ageGroup: generated.ageGroup,
  playerCount: generated.playerCount,
  theme: generated.theme,
  intention: generated.intention,
  blocks: generated.blocks.map((block) => ({
    id: block.id,
    activityId: block.activity.id,
    durationMinutes: block.durationMinutes,
  })),
  weekNumber: 1,
  slot: 0,
};

class InMemoryEducatorRepository implements EducatorRepository {
  constructor(private readonly ids: readonly string[]) {}

  async create(): Promise<EducatorRecord> {
    throw new Error("not used");
  }

  async existsById(id: string): Promise<boolean> {
    return this.ids.includes(id);
  }

  async findById(): Promise<EducatorRecord | null> {
    return null;
  }

  async findByEmail(): Promise<null> {
    return null;
  }

  async findByLinkedPlayerId(): Promise<null> {
    return null;
  }
}

class InMemoryTrainingSessionRepository implements TrainingSessionRepository {
  readonly created: PersistedTrainingSession[] = [];

  async create(
    educatorId: string,
    input: {
      title: string;
      ageGroup: PersistedTrainingSession["ageGroup"];
      playerCount: number;
      theme: PersistedTrainingSession["theme"];
      intention: string;
      blocks: PersistedTrainingSessionBlock[];
      weekNumber: number;
      slot: number;
    },
  ): Promise<PersistedTrainingSession> {
    const existing = this.created.find(
      (session) =>
        session.educatorId === educatorId && session.weekNumber === input.weekNumber && session.slot === input.slot,
    );
    if (existing) {
      Object.assign(existing, input);
      return existing;
    }
    const record: PersistedTrainingSession = {
      id: `session-${this.created.length + 1}`,
      educatorId,
      ...input,
      createdAt: new Date("2026-08-29T12:00:00.000Z"),
    };
    this.created.push(record);
    return record;
  }

  async listByEducator(educatorId: string): Promise<PersistedTrainingSession[]> {
    return this.created.filter((session) => session.educatorId === educatorId);
  }

  async findById(id: string, educatorId: string): Promise<PersistedTrainingSession | null> {
    return this.created.find((session) => session.id === id && session.educatorId === educatorId) ?? null;
  }
}

describe("TrainingSessionService.save", () => {
  it("rejects an unknown activity id before writing anything", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(
      new InMemoryEducatorRepository(["educator-1"]),
      trainingSessionRepository,
    );

    await expect(
      service.save("educator-1", { ...validInput, blocks: [{ id: "b1", activityId: "does-not-exist", durationMinutes: 20 }] }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(trainingSessionRepository.created).toHaveLength(0);
  });

  it("rejects an unknown age group before writing anything", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(
      new InMemoryEducatorRepository(["educator-1"]),
      trainingSessionRepository,
    );

    await expect(
      service.save("educator-1", { ...validInput, ageGroup: "U9" as unknown as TrainingSessionInput["ageGroup"] }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(trainingSessionRepository.created).toHaveLength(0);
  });

  it("rejects an unknown theme before writing anything", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(
      new InMemoryEducatorRepository(["educator-1"]),
      trainingSessionRepository,
    );

    await expect(
      service.save("educator-1", { ...validInput, theme: "Autre thème" as unknown as TrainingSessionInput["theme"] }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(trainingSessionRepository.created).toHaveLength(0);
  });

  it("rejects a session shorter than 60 minutes", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(
      new InMemoryEducatorRepository(["educator-1"]),
      trainingSessionRepository,
    );
    const tooShort: TrainingSessionInput = {
      ...validInput,
      blocks: validInput.blocks.map((block) => ({ ...block, durationMinutes: 5 })),
    };

    await expect(service.save("educator-1", tooShort)).rejects.toThrow(
      "La séance doit durer entre 60 et 90 minutes.",
    );
    expect(trainingSessionRepository.created).toHaveLength(0);
  });

  it("rejects saving a valid session for an educator that does not exist", async () => {
    const service = new TrainingSessionService(
      new InMemoryEducatorRepository([]),
      new InMemoryTrainingSessionRepository(),
    );

    await expect(service.save("missing", validInput)).rejects.toBeInstanceOf(EducatorNotFoundError);
  });

  it("saves a valid session, storing only the activity id per block", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(
      new InMemoryEducatorRepository(["educator-1"]),
      trainingSessionRepository,
    );

    const saved = await service.save("educator-1", validInput);

    expect(saved.educatorId).toBe("educator-1");
    expect(saved.title).toBe(validInput.title);
    expect(saved.blocks).toEqual(validInput.blocks);
    expect(saved.weekNumber).toBe(1);
    expect(saved.slot).toBe(0);
  });

  it("rejects a cycle week outside 1..4", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(
      new InMemoryEducatorRepository(["educator-1"]),
      trainingSessionRepository,
    );

    await expect(service.save("educator-1", { ...validInput, weekNumber: 5 })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.save("educator-1", { ...validInput, slot: -1 })).rejects.toBeInstanceOf(ValidationError);
    expect(trainingSessionRepository.created).toHaveLength(0);
  });

  it("replaces the session already stored for the same cycle slot", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(
      new InMemoryEducatorRepository(["educator-1"]),
      trainingSessionRepository,
    );

    const first = await service.save("educator-1", { ...validInput, weekNumber: 2, slot: 1, title: "Séance A" });
    const second = await service.save("educator-1", { ...validInput, weekNumber: 2, slot: 1, title: "Séance B" });

    expect(trainingSessionRepository.created).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(second.title).toBe("Séance B");
  });

  it("lists and fetches saved sessions by id", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(
      new InMemoryEducatorRepository(["educator-1"]),
      trainingSessionRepository,
    );

    const saved = await service.save("educator-1", { ...validInput, weekNumber: 1, slot: 0 });

    expect(await service.list("educator-1")).toHaveLength(1);
    expect(await service.getById("educator-1", saved.id)).toMatchObject({ id: saved.id });
    expect(await service.getById("educator-2", saved.id)).toBeNull();
  });
});
