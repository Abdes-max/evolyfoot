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
    },
  ): Promise<PersistedTrainingSession> {
    const record: PersistedTrainingSession = {
      id: `session-${this.created.length + 1}`,
      educatorId,
      ...input,
      createdAt: new Date("2026-08-29T12:00:00.000Z"),
    };
    this.created.push(record);
    return record;
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
  });
});
