import { describe, expect, it } from "vitest";
import { normalizeEducatorEmail, validateEmailFormat } from "./email";

describe("normalizeEducatorEmail", () => {
  it("trims and lowercases an educator email", () => {
    expect(normalizeEducatorEmail("  Coach.Example@EVOLYFOOT.FR ")).toBe("coach.example@evolyfoot.fr");
  });

  it("rejects an empty email", () => {
    expect(() => normalizeEducatorEmail("   ")).toThrow("L’adresse e-mail de l’éducateur est obligatoire.");
  });
});

describe("validateEmailFormat", () => {
  it("accepte une adresse courante", () => {
    expect(validateEmailFormat("coach.example@evolyfoot.fr")).toBe("coach.example@evolyfoot.fr");
  });

  it.each(["nope", "a@b", "a b@c.fr", "@c.fr", "a@@c.fr", "a@c.", "a@.fr", `${"x".repeat(250)}@c.fr`])("refuse %s", (email) => {
    expect(() => validateEmailFormat(email)).toThrow("Cette adresse e-mail n’est pas valide.");
  });
});
