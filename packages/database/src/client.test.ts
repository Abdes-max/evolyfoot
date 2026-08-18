import { describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";

describe("createDatabaseClient", () => {
  it("rejects a blank database URL before constructing an adapter", () => {
    expect(() => createDatabaseClient("   ")).toThrow("DATABASE_URL est obligatoire.");
  });
});
