import { describe, expect, it } from "vitest";
import { validateTournament } from "./tournament";

describe("tournament", () => {
  it("accepte une fiche valide", () => {
    expect(validateTournament({ name: "Tournoi de printemps", dateLabel: "12 avril 2026" })).toEqual({});
  });

  it("signale un nom manquant", () => {
    expect(validateTournament({ name: "  ", dateLabel: "12 avril 2026" }).name).toMatch(/nom/i);
  });

  it("signale une date manquante", () => {
    expect(validateTournament({ name: "Tournoi", dateLabel: " " }).dateLabel).toMatch(/date/i);
  });
});
