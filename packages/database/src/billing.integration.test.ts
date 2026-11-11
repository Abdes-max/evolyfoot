import { afterAll, describe, expect, it } from "vitest";
import { BillingService } from "./billing-service";
import { createDatabaseClient } from "./client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d’intégration.");
}

const database = createDatabaseClient(databaseUrl);
const service = new BillingService(database.prisma);
const run = crypto.randomUUID();
const created: string[] = [];

async function account(name: string, data: { role?: string; ownerEducatorId?: string; createdAt?: Date } = {}) {
  const record = await database.prisma.educator.create({
    data: { email: `billing-${name}-${run}@example.test`, displayName: name, passwordHash: "x", ...data },
  });
  created.push(record.id);
  return record;
}

afterAll(async () => {
  await database.prisma.educator.deleteMany({ where: { id: { in: created } } });
  await database.disconnect();
});

describe("BillingService", () => {
  it("compte les équipes et adjoints en plus, et renvoie au coach depuis un adjoint d'équipe", async () => {
    const coach = await account("coach", { createdAt: new Date("2026-11-01T10:00:00Z") });
    const space = await account("equipe", { role: "team", ownerEducatorId: coach.id });
    await account("adjoint1", { role: "assistant", ownerEducatorId: coach.id });
    const assistant = await account("adjoint2", { role: "assistant", ownerEducatorId: space.id });

    const summary = await service.summary(assistant.id, new Date("2026-11-10T10:00:00Z"));
    expect(summary.coachId).toBe(coach.id);
    expect(summary.extraTeams).toBe(1);
    expect(summary.extraCoaches).toBe(2);
    expect(summary.access).toMatchObject({ state: "trial", daysLeft: 5 });
  });

  it("enregistre l'abonnement reçu de Stripe par le client", async () => {
    const coach = await account("abonne");
    await service.setCustomer(coach.id, `cus_${run}`);
    expect(
      await service.applySubscription(`cus_${run}`, { subscriptionId: "sub_1", status: "active", cycle: "season", currentPeriodEnd: new Date("2027-11-14") }),
    ).toBe(true);
    const summary = await service.summary(coach.id);
    expect(summary.access).toEqual({ state: "subscribed", status: "active" });
    expect(summary.billingCycle).toBe("season");
    expect(await service.applySubscription("cus_inconnu", { subscriptionId: "sub_2", status: "active", cycle: null, currentPeriodEnd: null })).toBe(false);
  });
});
