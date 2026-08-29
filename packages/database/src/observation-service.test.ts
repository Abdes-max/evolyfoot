import { createObservationDraft, diagnosticCriteria, rateObservation } from "@evolyfoot/domain";
import type { ObservationDraft } from "@evolyfoot/domain";
import { describe, expect, it } from "vitest";
import { ObservationService } from "./observation-service";
import { EducatorNotFoundError, ValidationError } from "./errors";
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
