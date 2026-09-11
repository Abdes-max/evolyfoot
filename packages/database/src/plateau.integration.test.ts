import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { PlateauNotFoundError, ValidationError } from "./errors";
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

  it("fetches a plateau by id, scoped to its educator", async () => {
    const owner = await createEducator("find-by-id");
    const stranger = await createEducator("find-by-id-stranger");
    const plateau = await service.create(owner.id, { name: "Plateau", dateLabel: "14 septembre 2026" });

    await expect(service.getById(owner.id, plateau.id)).resolves.toMatchObject({ id: plateau.id });
    await expect(service.getById(stranger.id, plateau.id)).resolves.toBeNull();
  });

  it("modifie date/lieu/description/bilan indépendamment du nom et de la date d’affichage", async () => {
    const educator = await createEducator("details-update");
    const plateau = await service.create(educator.id, { name: "Plateau", dateLabel: "14 septembre 2026" });
    const date = new Date("2026-09-14T00:00:00.000Z");

    const updated = await service.updateDetails(educator.id, plateau.id, {
      date,
      location: "Stade Marius Requier",
      description: "Plateau U10 sur herbe",
      result: "3 victoires",
    });
    expect(updated.date).toEqual(date);
    expect(updated.location).toBe("Stade Marius Requier");
    expect(updated.description).toBe("Plateau U10 sur herbe");
    expect(updated.result).toBe("3 victoires");
    expect(updated.name).toBe("Plateau");
  });

  it("rejette la modification des détails d’un plateau introuvable ou appartenant à un autre éducateur", async () => {
    const owner = await createEducator("details-owner");
    const stranger = await createEducator("details-stranger");
    const plateau = await service.create(owner.id, { name: "Plateau", dateLabel: "14 septembre 2026" });

    await expect(service.updateDetails(stranger.id, plateau.id, { location: "Ailleurs" })).rejects.toBeInstanceOf(
      PlateauNotFoundError,
    );
    await expect(
      service.updateDetails(owner.id, "00000000-0000-0000-0000-000000000000", { location: "Ailleurs" }),
    ).rejects.toBeInstanceOf(PlateauNotFoundError);
  });
});
