import type { DiagnosticScores } from "@evolyfoot/domain";
import { describe, expect, it } from "vitest";
import { DiagnosticService } from "./diagnostic-service";
import { DiagnosticNotFoundError, EducatorNotFoundError } from "./errors";
import type { DiagnosticRepository, EducatorRecord, EducatorRepository, PersistedDiagnostic } from "./repositories";

const validScores: DiagnosticScores = { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 };

class InMemoryEducatorRepository implements EducatorRepository {
  private readonly educators = new Map<string, EducatorRecord>();

  constructor(ids: readonly string[]) {
    for (const id of ids) {
      this.educators.set(id, {
        id,
        email: `${id}@example.test`,
        displayName: id,
        createdAt: new Date("2026-08-29T12:00:00.000Z"),
        updatedAt: new Date("2026-08-29T12:00:00.000Z"),
      });
    }
  }

  async create(input: { email: string; displayName: string; passwordHash: string }): Promise<EducatorRecord> {
    const id = `educator-${this.educators.size + 1}`;
    const educator: EducatorRecord = {
      id,
      email: input.email,
      displayName: input.displayName,
      createdAt: new Date("2026-08-29T12:00:00.000Z"),
      updatedAt: new Date("2026-08-29T12:00:00.000Z"),
    };
    this.educators.set(id, educator);
    return educator;
  }

  async existsById(id: string): Promise<boolean> {
    return this.educators.has(id);
  }

  async findById(id: string): Promise<EducatorRecord | null> {
    return this.educators.get(id) ?? null;
  }

  async findByEmail(): Promise<null> {
    return null;
  }
}

class InMemoryDiagnosticRepository implements DiagnosticRepository {
  readonly diagnosticsByEducatorId = new Map<string, PersistedDiagnostic>();
  readonly readEducatorIds: string[] = [];
  writeCount = 0;

  async upsertForEducator(educatorId: string, scores: DiagnosticScores): Promise<PersistedDiagnostic> {
    this.writeCount += 1;
    const existing = this.diagnosticsByEducatorId.get(educatorId);
    const saved: PersistedDiagnostic = {
      id: existing?.id ?? `diagnostic-${educatorId}`,
      educatorId,
      scores,
      createdAt: existing?.createdAt ?? new Date("2026-08-29T12:00:00.000Z"),
      updatedAt: new Date("2026-08-29T12:00:00.000Z"),
    };
    this.diagnosticsByEducatorId.set(educatorId, saved);
    return saved;
  }

  async findForEducator(educatorId: string): Promise<PersistedDiagnostic | null> {
    this.readEducatorIds.push(educatorId);
    return this.diagnosticsByEducatorId.get(educatorId) ?? null;
  }
}

describe("DiagnosticService.save", () => {
  it("rejects a score outside 1-4 before writing anything", async () => {
    const diagnosticRepository = new InMemoryDiagnosticRepository();
    const service = new DiagnosticService(new InMemoryEducatorRepository(["educator-1"]), diagnosticRepository);

    await expect(service.save("educator-1", { ...validScores, availability: 5 })).rejects.toThrow(
      "Chaque critère doit être évalué de 1 à 4.",
    );
    expect(diagnosticRepository.writeCount).toBe(0);
  });

  it("rejects saving a valid diagnostic for an educator that does not exist", async () => {
    const service = new DiagnosticService(new InMemoryEducatorRepository([]), new InMemoryDiagnosticRepository());

    await expect(service.save("missing", validScores)).rejects.toBeInstanceOf(EducatorNotFoundError);
  });

  it("saves a valid diagnostic for its educator", async () => {
    const service = new DiagnosticService(
      new InMemoryEducatorRepository(["educator-1"]),
      new InMemoryDiagnosticRepository(),
    );

    const saved = await service.save("educator-1", validScores);

    expect(saved.educatorId).toBe("educator-1");
    expect(saved.scores).toEqual(validScores);
  });

  it("overwrites the previous diagnostic for the same educator rather than duplicating it", async () => {
    const diagnosticRepository = new InMemoryDiagnosticRepository();
    const service = new DiagnosticService(new InMemoryEducatorRepository(["educator-1"]), diagnosticRepository);

    const first = await service.save("educator-1", validScores);
    const second = await service.save("educator-1", { ...validScores, reactionAfterLoss: 4 });

    expect(second.id).toBe(first.id);
    expect(second.scores.reactionAfterLoss).toBe(4);
    expect(diagnosticRepository.diagnosticsByEducatorId.size).toBe(1);
  });
});

describe("DiagnosticService.get", () => {
  it("looks up a diagnostic using the caller educator ID", async () => {
    const diagnosticRepository = new InMemoryDiagnosticRepository();
    const service = new DiagnosticService(
      new InMemoryEducatorRepository(["educator-1", "educator-2"]),
      diagnosticRepository,
    );
    await service.save("educator-1", validScores);
    await service.save("educator-2", { ...validScores, scanning: 4 });

    const diagnostic = await service.get("educator-2");

    expect(diagnostic.scores.scanning).toBe(4);
    expect(diagnosticRepository.readEducatorIds).toEqual(["educator-2"]);
  });

  it("rejects a missing diagnostic for the calling educator", async () => {
    const service = new DiagnosticService(
      new InMemoryEducatorRepository(["educator-1"]),
      new InMemoryDiagnosticRepository(),
    );

    await expect(service.get("educator-1")).rejects.toBeInstanceOf(DiagnosticNotFoundError);
  });
});
