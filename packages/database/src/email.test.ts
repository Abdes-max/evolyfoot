import { describe, expect, it } from "vitest";
import { normalizeEducatorEmail } from "./email";

describe("normalizeEducatorEmail", () => {
  it("trims and lowercases an educator email", () => {
    expect(normalizeEducatorEmail("  Coach.Example@EVOLYFOOT.FR ")).toBe("coach.example@evolyfoot.fr");
  });

  it("rejects an empty email", () => {
    expect(() => normalizeEducatorEmail("   ")).toThrow("L’adresse e-mail de l’éducateur est obligatoire.");
  });
});
