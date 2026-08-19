import { describe, expect, it } from "vitest";
import { createDatabaseHealthHandler } from "@/server/database-health";

describe("database health handler", () => {
  it("returns an ok JSON response when the database check succeeds", async () => {
    const response = await createDatabaseHealthHandler(
      async () => undefined,
      () => undefined,
    )();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("returns an information-safe unavailable response and logs the original error", async () => {
    const errors: unknown[] = [];
    const failure = new Error("postgres://secret-host/internal");

    const response = await createDatabaseHealthHandler(
      async () => {
        throw failure;
      },
      errors.push.bind(errors),
    )();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: "unavailable" });
    expect(JSON.stringify(body)).not.toContain("secret-host");
    expect(errors).toEqual([failure]);
  });
});
