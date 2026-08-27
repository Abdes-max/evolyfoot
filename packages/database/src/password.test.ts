import { describe, expect, it } from "vitest";
import { hashPassword, validatePassword, verifyPassword } from "./password";

describe("validatePassword", () => {
  it("rejects a password shorter than 10 characters", () => {
    expect(() => validatePassword("court1234")).toThrow(
      "Le mot de passe doit contenir au moins 10 caractères.",
    );
  });

  it("accepts a password of at least 10 characters", () => {
    expect(validatePassword("motdepasse1")).toBe("motdepasse1");
  });
});

describe("hashPassword / verifyPassword", () => {
  it("verifies a password against its own hash", async () => {
    const hash = await hashPassword("motdepasse1");

    await expect(verifyPassword("motdepasse1", hash)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("motdepasse1");

    await expect(verifyPassword("autremotdepasse", hash)).resolves.toBe(false);
  });

  it("produces a different hash for the same password on each call", async () => {
    const first = await hashPassword("motdepasse1");
    const second = await hashPassword("motdepasse1");

    expect(first).not.toBe(second);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    await expect(verifyPassword("motdepasse1", "not-a-valid-hash")).resolves.toBe(false);
  });
});
