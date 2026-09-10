import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { ValidationError } from "./errors";
import { PlateauService } from "./plateau-service";
import { PrismaEducatorRepository, PrismaPlateauRepository } from "./prisma-repositories";

const testRun = `plateau-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const educatorRepository = new PrismaEducatorRepository(database.prisma);
const plateauRepository = new PrismaPlateauRepository(database.prisma);
const service = new PlateauService(educatorRepository, plateauRepository);

async function createEducator(suffix: string) {
  return educatorRepository.create({
    email: `${testRun}-${suffix}@example.test`,
    displayName: `${testRun}-${suffix}`,
    passwordHash: "test-hash",
  });
}

async function removeTestEducators(): Promise<void> {
  await database.prisma.educator.deleteMany({ where: { displayName: { startsWith: testRun } } });
}

describe("PostgreSQL plateau persistence", () => {
  beforeAll(removeTestEducators);
  afterEach(removeTestEducators);
  afterAll(() => database.disconnect());

  it("creates and lists plateaux most recent first", async () => {
    const educator = await createEducator("list");
    await service.create(educator.id, { name: "Plateau de rentrée", dateLabel: "14 septembre 2026" });
    await service.create(educator.id, { name: "Plateau d’hiver", dateLabel: "10 janvier 2027", result: "3 victoires" });

    const plateaux = await service.list(educator.id);

    expect(plateaux.map((plateau) => plateau.name)).toEqual(["Plateau d’hiver", "Plateau de rentrée"]);
    expect(plateaux[0]!.result).toBe("3 victoires");
    expect(plateaux[1]!.result).toBeNull();
  });

  it("rejects a plateau without a name", async () => {
    const educator = await createEducator("invalid");

    await expect(service.create(educator.id, { name: "  ", dateLabel: "14 septembre 2026" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("removes a plateau only for its owning educator, silently no-ops otherwise", async () => {
    const owner = await createEducator("owner");
    const stranger = await createEducator("stranger");
    const plateau = await service.create(owner.id, { name: "Plateau", dateLabel: "14 septembre 2026" });

    await service.remove(stranger.id, plateau.id);
    await expect(service.list(owner.id)).resolves.toHaveLength(1);

    await service.remove(owner.id, plateau.id);
    await expect(service.list(owner.id)).resolves.toHaveLength(0);
  });

  it("cascades a test educator deletion to its plateaux", async () => {
    const educator = await createEducator("cascade");
    await service.create(educator.id, { name: "Plateau", dateLabel: "14 septembre 2026" });

    await database.prisma.educator.delete({ where: { id: educator.id } });

    await expect(database.prisma.plateauRecord.count({ where: { educatorId: educator.id } })).resolves.toBe(0);
  });
});
