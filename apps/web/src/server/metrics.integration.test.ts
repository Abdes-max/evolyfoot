import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMetricsHandler, type MvpMetrics } from "./metrics";

const admin = { id: "1", email: "coach-admin@example.test", displayName: "Admin" };
const educator = { id: "2", email: "coach@example.test", displayName: "Coach" };

const sampleMetrics: MvpMetrics = {
  funnel: [
    { label: "Comptes créés", count: 10 },
    { label: "Équipe configurée", count: 8 },
    { label: "Diagnostic réalisé", count: 5 },
    { label: "Première séance validée", count: 3 },
    { label: "Première observation validée", count: 2 },
  ],
  weeklyActivity: [{ weekStart: "2026-08-24", activeEducators: 3 }],
  retention: { retainedFourWeeks: 1, activeLastFourWeeks: 3 },
  rosterAdoption: { educatorsWithPlayers: 2, totalEducators: 10 },
};

const authenticatedAsAdmin = async () => admin;
const authenticatedAsEducator = async () => educator;
const anonymous = async () => null;

describe("createMetricsHandler", () => {
  const originalAdminEmails = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    process.env.ADMIN_EMAILS = "coach-admin@example.test";
  });

  afterEach(() => {
    process.env.ADMIN_EMAILS = originalAdminEmails;
  });

  it("requires an authenticated session", async () => {
    const handler = createMetricsHandler(anonymous, { get: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/admin/metrics"));

    expect(response.status).toBe(401);
  });

  it("rejects an authenticated educator who is not on the admin allowlist", async () => {
    const handler = createMetricsHandler(
      authenticatedAsEducator,
      { get: async () => { throw new Error("not called"); } },
      () => undefined,
    );

    const response = await handler(new Request("https://evolyfoot.test/api/admin/metrics"));

    expect(response.status).toBe(403);
  });

  it("is case-insensitive when matching the admin allowlist", async () => {
    process.env.ADMIN_EMAILS = "Coach-Admin@Example.test";
    const handler = createMetricsHandler(authenticatedAsAdmin, { get: async () => sampleMetrics }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/admin/metrics"));

    expect(response.status).toBe(200);
  });

  it("returns the aggregated metrics for an admin", async () => {
    const handler = createMetricsHandler(authenticatedAsAdmin, { get: async () => sampleMetrics }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/admin/metrics"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(sampleMetrics);
  });

  it("logs and returns an information-safe 500 for an unexpected error", async () => {
    const errors: unknown[] = [];
    const failure = new Error("postgres://secret-host/internal");
    const handler = createMetricsHandler(
      authenticatedAsAdmin,
      { get: async () => { throw failure; } },
      errors.push.bind(errors),
    );

    const response = await handler(new Request("https://evolyfoot.test/api/admin/metrics"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret-host");
    expect(errors).toEqual([failure]);
  });

  it("treats an empty allowlist as denying everyone", async () => {
    process.env.ADMIN_EMAILS = "";
    const handler = createMetricsHandler(
      authenticatedAsAdmin,
      { get: async () => { throw new Error("not called"); } },
      () => undefined,
    );

    const response = await handler(new Request("https://evolyfoot.test/api/admin/metrics"));

    expect(response.status).toBe(403);
  });

  it("treats an unset allowlist as denying everyone", async () => {
    delete process.env.ADMIN_EMAILS;
    const handler = createMetricsHandler(
      authenticatedAsAdmin,
      { get: async () => { throw new Error("not called"); } },
      () => undefined,
    );

    const response = await handler(new Request("https://evolyfoot.test/api/admin/metrics"));

    expect(response.status).toBe(403);
  });
});
