import { generateTrainingSession } from "@evolyfoot/domain";
import { describe, expect, it } from "vitest";
import { TrainingSessionService, type TrainingSessionInput } from "./training-session-service";
import { EducatorNotFoundError, TrainingSessionNotFoundError, ValidationError } from "./errors";
import type { EducatorRecord, EducatorRepository, PersistedTrainingSession, PersistedTrainingSessionBlock, TrainingSessionRepository } from "./repositories";

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
  meetingAt: new Date("2026-09-15T18:00:00.000Z"),
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

  async markEmailVerified(): Promise<void> {}
}

class InMemoryTrainingSessionRepository implements TrainingSessionRepository {
  readonly created: PersistedTrainingSession[] = [];
  cycle = 1;

  async currentCycle(): Promise<number> {
    return this.cycle;
  }

  async advanceCycle(): Promise<number> {
    this.cycle += 1;
    return this.cycle;
  }

  async create(
    educatorId: string,
    input: {
      title: string;
      ageGroup: PersistedTrainingSession["ageGroup"];
      playerCount: number;
      theme: PersistedTrainingSession["theme"];
      intention: string;
      blocks: PersistedTrainingSessionBlock[];
      cycleNumber: number;
      weekNumber: number;
      slot: number;
    },
  ): Promise<PersistedTrainingSession> {
    const existing = this.created.find(
      (session) =>
        session.educatorId === educatorId &&
        session.cycleNumber === input.cycleNumber &&
        session.weekNumber === input.weekNumber &&
        session.slot === input.slot,
    );
    if (existing) {
      Object.assign(existing, input);
      return existing;
    }
    const record: PersistedTrainingSession = {
      id: `session-${this.created.length + 1}`,
      educatorId,
      meetingAt: null,
      location: null,
      description: null,
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

  async update(
    id: string,
    educatorId: string,
    input: { meetingAt?: Date | null; location?: string | null; description?: string | null; attendance?: PersistedTrainingSession["attendance"] },
  ): Promise<PersistedTrainingSession> {
    const record = this.created.find((session) => session.id === id && session.educatorId === educatorId);
    if (!record) {
      throw new TrainingSessionNotFoundError();
    }
    Object.assign(record, input);
    return record;
  }
}

describe("TrainingSessionService cycles", () => {
  const session = { ...validInput, meetingAt: new Date("2026-11-03T18:00:00.000Z") };

  it("refuse de passer au cycle suivant sans séance", async () => {
    const service = new TrainingSessionService(new InMemoryEducatorRepository(["educator-1"]), new InMemoryTrainingSessionRepository());

    await expect(service.startNextCycle("educator-1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("libère les créneaux du nouveau cycle et garde l'historique pour la saison", async () => {
    const service = new TrainingSessionService(new InMemoryEducatorRepository(["educator-1"]), new InMemoryTrainingSessionRepository());
    await service.save("educator-1", session);

    expect(await service.startNextCycle("educator-1")).toBe(2);
    expect(await service.list("educator-1")).toEqual([]);

    await service.save("educator-1", session);

    expect(await service.list("educator-1")).toHaveLength(1);
    expect((await service.listSeason("educator-1")).map((saved) => saved.cycleNumber)).toEqual([1, 2]);
  });
});

describe("TrainingSessionService.save", () => {
  it("rejects an unknown activity id before writing anything", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(new InMemoryEducatorRepository(["educator-1"]), trainingSessionRepository);

    await expect(
      service.save("educator-1", { ...validInput, blocks: [{ id: "b1", activityId: "does-not-exist", durationMinutes: 20 }] }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(trainingSessionRepository.created).toHaveLength(0);
  });

  it("rejects an unknown age group before writing anything", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(new InMemoryEducatorRepository(["educator-1"]), trainingSessionRepository);

    await expect(service.save("educator-1", { ...validInput, ageGroup: "U9" as unknown as TrainingSessionInput["ageGroup"] })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(trainingSessionRepository.created).toHaveLength(0);
  });

  it("rejects an unknown theme before writing anything", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(new InMemoryEducatorRepository(["educator-1"]), trainingSessionRepository);

    await expect(service.save("educator-1", { ...validInput, theme: "Autre thème" as unknown as TrainingSessionInput["theme"] })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(trainingSessionRepository.created).toHaveLength(0);
  });

  it("rejects a session shorter than 60 minutes", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(new InMemoryEducatorRepository(["educator-1"]), trainingSessionRepository);
    const tooShort: TrainingSessionInput = {
      ...validInput,
      blocks: validInput.blocks.map((block) => ({ ...block, durationMinutes: 5 })),
    };

    await expect(service.save("educator-1", tooShort)).rejects.toThrow("La séance doit durer entre 60 et 90 minutes.");
    expect(trainingSessionRepository.created).toHaveLength(0);
  });

  it("rejects saving a valid session for an educator that does not exist", async () => {
    const service = new TrainingSessionService(new InMemoryEducatorRepository([]), new InMemoryTrainingSessionRepository());

    await expect(service.save("missing", validInput)).rejects.toBeInstanceOf(EducatorNotFoundError);
  });

  it("saves a valid session, storing only the activity id per block", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(new InMemoryEducatorRepository(["educator-1"]), trainingSessionRepository);

    const saved = await service.save("educator-1", validInput);

    expect(saved.educatorId).toBe("educator-1");
    expect(saved.title).toBe(validInput.title);
    expect(saved.blocks).toEqual(validInput.blocks);
    expect(saved.weekNumber).toBe(1);
    expect(saved.slot).toBe(0);
  });

  it("rejects a cycle week outside 1..4", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(new InMemoryEducatorRepository(["educator-1"]), trainingSessionRepository);

    await expect(service.save("educator-1", { ...validInput, weekNumber: 5 })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.save("educator-1", { ...validInput, slot: -1 })).rejects.toBeInstanceOf(ValidationError);
    expect(trainingSessionRepository.created).toHaveLength(0);
  });

  it("replaces the session already stored for the same cycle slot", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(new InMemoryEducatorRepository(["educator-1"]), trainingSessionRepository);

    const first = await service.save("educator-1", { ...validInput, weekNumber: 2, slot: 1, title: "Séance A" });
    const second = await service.save("educator-1", { ...validInput, weekNumber: 2, slot: 1, title: "Séance B" });

    expect(trainingSessionRepository.created).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(second.title).toBe("Séance B");
  });

  it("lists and fetches saved sessions by id", async () => {
    const trainingSessionRepository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(new InMemoryEducatorRepository(["educator-1"]), trainingSessionRepository);

    const saved = await service.save("educator-1", { ...validInput, weekNumber: 1, slot: 0 });

    expect(await service.list("educator-1")).toHaveLength(1);
    expect(await service.getById("educator-1", saved.id)).toMatchObject({ id: saved.id });
    expect(await service.getById("educator-2", saved.id)).toBeNull();
  });
});

describe("TrainingSessionService.prepareFromSeason", () => {
  const input = {
    sessionNumber: 3,
    seasonWeek: 9,
    slot: 1,
    ageGroup: "U11" as const,
    playerCount: 16,
    meetingAt: new Date("2026-11-04T17:00:00.000Z"),
    location: "  Stade municipal, terrain 2 ",
  };

  it("enregistre la séance type dans le cycle réservé, avec son lieu et ses situations", async () => {
    const repository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(new InMemoryEducatorRepository(["educator-1"]), repository);

    const session = await service.prepareFromSeason("educator-1", input);

    expect(session).toMatchObject({ cycleNumber: 0, weekNumber: 9, slot: 1, location: "Stade municipal, terrain 2", theme: "Conserver le ballon" });
    expect(session.title).toBe("Séance 3 · Créer et utiliser les espaces");
    expect(session.blocks.map((block) => block.activityId)[0]).toBe("cfi-espaces-jonglage");
    expect(session.blocks.reduce((sum, block) => sum + block.durationMinutes, 0)).toBe(75);
  });

  it("exige un lieu, une date et une semaine de saison valides", async () => {
    const repository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(new InMemoryEducatorRepository(["educator-1"]), repository);

    await expect(service.prepareFromSeason("educator-1", { ...input, location: "  " })).rejects.toThrow("Indique le lieu de la séance.");
    await expect(service.prepareFromSeason("educator-1", { ...input, meetingAt: new Date("x") })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.prepareFromSeason("educator-1", { ...input, seasonWeek: 37 })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.prepareFromSeason("educator-1", { ...input, sessionNumber: 99 })).rejects.toThrow("Séance de la saison inconnue.");
    await expect(service.prepareFromSeason("inconnu", input)).rejects.toBeInstanceOf(EducatorNotFoundError);
    expect(repository.created).toHaveLength(0);
  });

  it("ré-enregistre une séance modifiée dans sa semaine de saison", async () => {
    const repository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(new InMemoryEducatorRepository(["educator-1"]), repository);
    const prepared = await service.prepareFromSeason("educator-1", input);

    await service.save("educator-1", {
      ...validInput,
      blocks: prepared.blocks,
      weekNumber: 9,
      slot: 1,
      guidedSeason: true,
    });

    expect(repository.created).toHaveLength(1);
    await expect(service.save("educator-1", { ...validInput, weekNumber: 9 })).rejects.toThrow("La semaine du cycle doit être comprise entre 1 et 4.");
  });
});

describe("TrainingSessionService : durée de préparation", () => {
  it("garde une durée plausible et ignore les autres", async () => {
    const repository = new InMemoryTrainingSessionRepository();
    const service = new TrainingSessionService(new InMemoryEducatorRepository(["educator-1"]), repository);

    await service.save("educator-1", { ...validInput, preparationSeconds: 420 });
    await service.save("educator-1", { ...validInput, slot: 1, preparationSeconds: -5 });
    await service.save("educator-1", { ...validInput, slot: 2, preparationSeconds: 12.5 });

    expect(repository.created.map((session) => (session as { preparationSeconds?: number }).preparationSeconds)).toEqual([420, undefined, undefined]);
  });
});
