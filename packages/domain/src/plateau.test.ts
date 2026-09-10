import { describe, expect, it } from "vitest";
import { validatePlateau } from "./plateau";

describe("plateau", () => {
  it("accepte une fiche valide", () => {
    expect(validatePlateau({ name: "Plateau de rentrée", dateLabel: "14 septembre 2026" })).toEqual({});
  });

  it("signale un nom manquant", () => {
    expect(validatePlateau({ name: "  ", dateLabel: "14 septembre 2026" }).name).toMatch(/nom/i);
  });

  it("signale une date manquante", () => {
    expect(validatePlateau({ name: "Plateau", dateLabel: " " }).dateLabel).toMatch(/date/i);
  });
});
