import { createObservationDraft, diagnosticCriteria, rateObservation } from "@evolyfoot/domain";
import type { ObservationDraft } from "@evolyfoot/domain";
import { describe, expect, it } from "vitest";
import { ObservationService } from "./observation-service";
import { EducatorNotFoundError, ObservationNotFoundError, ValidationError } from "./errors";
import type {
  EducatorRecord,
  EducatorRepository,
  ObservationRepository,
  PersistedObservation,
} from "./repositories";

const players = [{ id: "lina", name: "Lina" }];

function completeDraft(): ObservationDraft {
  let draft = createObservationDraft("training", "Observation de séance", players);
  for (const criterion of diagnosticCriteria) {
    draft = rateObservation(draft, criterion.id, "progress");
  }
  return draft;
}

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

class InMemoryObservationRepository implements ObservationRepository {
  readonly created: PersistedObservation[] = [];

  async create(educatorId: string, report: Parameters<ObservationRepository["create"]>[1]): Promise<PersistedObservation> {
    const record: PersistedObservation = {
      id: `observation-${this.created.length + 1}`,
      educatorId,
      eventType: report.eventType,
      title: report.title,
      dateLabel: report.dateLabel,
      players: report.players,
      ratings: report.ratings,
      signals: report.signals,
      ...(report.note ? { note: report.note } : {}),
      summary: report.summary,
      createdAt: new Date("2026-08-29T12:00:00.000Z"),
    };
    this.created.push(record);
    return record;
  }

  async listByEducator(educatorId: string): Promise<PersistedObservation[]> {
    return this.created.filter((observation) => observation.educatorId === educatorId);
  }

  async findById(id: string, educatorId: string): Promise<PersistedObservation | null> {
    return this.created.find((observation) => observation.id === id && observation.educatorId === educatorId) ?? null;
  }
}

describe("ObservationService.save", () => {
  it("rejects an incomplete draft before writing anything", async () => {
    const observationRepository = new InMemoryObservationRepository();
    const service = new ObservationService(new InMemoryEducatorRepository(["educator-1"]), observationRepository);
    const incomplete = createObservationDraft("training", "Observation de séance", players);

    await expect(service.save("educator-1", incomplete)).rejects.toBeInstanceOf(ValidationError);
    expect(observationRepository.created).toHaveLength(0);
  });

  it("rejects saving a complete observation for an educator that does not exist", async () => {
    const service = new ObservationService(new InMemoryEducatorRepository([]), new InMemoryObservationRepository());

    await expect(service.save("missing", completeDraft())).rejects.toBeInstanceOf(EducatorNotFoundError);
  });

  it("saves a complete observation, recomputing the summary server-side", async () => {
    const observationRepository = new InMemoryObservationRepository();
    const service = new ObservationService(new InMemoryEducatorRepository(["educator-1"]), observationRepository);

    const saved = await service.save("educator-1", completeDraft());

    expect(saved.educatorId).toBe("educator-1");
    expect(saved.summary.trend).toBe("progress");
    expect(saved.ratings).toHaveLength(diagnosticCriteria.length);
  });
});

describe("ObservationService.list / get", () => {
  it("lists only the requesting educator's observations, most recent first", async () => {
    const observationRepository = new InMemoryObservationRepository();
    const service = new ObservationService(new InMemoryEducatorRepository(["educator-1", "educator-2"]), observationRepository);
    await service.save("educator-1", completeDraft());
    await service.save("educator-2", completeDraft());

    const observations = await service.list("educator-1");

    expect(observations).toHaveLength(1);
    expect(observations[0].educatorId).toBe("educator-1");
  });

  it("gets a single observation belonging to the requesting educator", async () => {
    const observationRepository = new InMemoryObservationRepository();
    const service = new ObservationService(new InMemoryEducatorRepository(["educator-1"]), observationRepository);
    const saved = await service.save("educator-1", completeDraft());

    const fetched = await service.get("educator-1", saved.id);

    expect(fetched).toEqual(saved);
  });

  it("rejects getting an observation that does not exist, or belongs to another educator", async () => {
    const observationRepository = new InMemoryObservationRepository();
    const service = new ObservationService(new InMemoryEducatorRepository(["educator-1", "educator-2"]), observationRepository);
    const saved = await service.save("educator-1", completeDraft());

    await expect(service.get("educator-1", "missing")).rejects.toBeInstanceOf(ObservationNotFoundError);
    await expect(service.get("educator-2", saved.id)).rejects.toBeInstanceOf(ObservationNotFoundError);
  });
});
