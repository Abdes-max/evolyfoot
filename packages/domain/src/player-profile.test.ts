import { describe, expect, it } from "vitest";
import { isValidJerseyNumber, playerOverallScore } from "./player-profile";

describe("profil sportif", () => {
  it("calcule la note de la carte à partir de tous les aspects", () => {
    expect(playerOverallScore({ technique: 8, passe: 7, vitesse: 6, physique: 5, tactique: 7, mental: 9, tir: 6 })).toBe(6.9);
  });

  it("accepte un numéro d'un ou deux chiffres", () => {
    expect(isValidJerseyNumber("7")).toBe(true);
    expect(isValidJerseyNumber("10")).toBe(true);
    expect(isValidJerseyNumber("100")).toBe(false);
    expect(isValidJerseyNumber("A")).toBe(false);
  });
});
