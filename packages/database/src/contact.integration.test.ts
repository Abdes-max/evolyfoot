import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";
import { ContactMessageService } from "./contact-message-service";
import { ValidationError } from "./errors";
import { PrismaContactMessageRepository } from "./prisma-repositories";

const testRun = `contact-integration-${crypto.randomUUID()}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const service = new ContactMessageService(new PrismaContactMessageRepository(database.prisma));

async function removeTestMessages(): Promise<void> {
  await database.prisma.contactMessage.deleteMany({ where: { name: { startsWith: testRun } } });
}

describe("PostgreSQL contact message persistence", () => {
  beforeAll(removeTestMessages);
  afterEach(removeTestMessages);
  afterAll(() => database.disconnect());

  it("stores a trimmed message and lists it back", async () => {
    await service.submit({
      name: `  ${testRun}-alex  `,
      email: "  alex@example.test ",
      message: "  Bonjour, une question sur le cycle.  ",
    });

    const messages = (await service.list()).filter((message) => message.name === `${testRun}-alex`);

    expect(messages).toHaveLength(1);
    expect(messages[0]!.email).toBe("alex@example.test");
    expect(messages[0]!.message).toBe("Bonjour, une question sur le cycle.");
  });

  it("rejects an invalid e-mail", async () => {
    await expect(
      service.submit({ name: `${testRun}-x`, email: "pas-un-email", message: "Coucou" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an empty message", async () => {
    await expect(
      service.submit({ name: `${testRun}-y`, email: "y@example.test", message: "   " }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
