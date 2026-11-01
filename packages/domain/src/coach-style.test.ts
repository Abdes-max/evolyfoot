import { describe, expect, it } from "vitest";
import { allFormationIds, playStyleNote, playStyles } from "./coach-style";

describe("style de jeu de l'éducateur", () => {
  it("donne une règle à chaque style", () => {
    for (const style of playStyles) {
      expect(playStyleNote(style)).toContain(style);
    }
  });

  it("n'ajoute rien sans style reconnu", () => {
    expect(playStyleNote(null)).toBeNull();
    expect(playStyleNote("Autre")).toBeNull();
  });

  it("liste les formations sans doublon", () => {
    expect(allFormationIds).toContain("4-3-3");
    expect(new Set(allFormationIds).size).toBe(allFormationIds.length);
  });
});
