import { describe, expect, it } from "vitest";
import { concernedPlayers, isConcerned, parsePlayerSelection } from "./concerned-players";

const roster = [
  { id: "a", name: "Ana" },
  { id: "b", name: "Bilal" },
  { id: "c", name: "Chloé" },
];

describe("joueurs concernés", () => {
  it("considère tout l'effectif concerné sans sélection", () => {
    expect(isConcerned(null, "a")).toBe(true);
    expect(isConcerned(undefined, "a")).toBe(true);
    expect(concernedPlayers(roster, null)).toHaveLength(3);
  });

  it("limite aux joueurs cochés", () => {
    expect(isConcerned(["a"], "b")).toBe(false);
    expect(concernedPlayers(roster, ["a", "c"]).map((player) => player.id)).toEqual(["a", "c"]);
  });

  it("lit une sélection de formulaire", () => {
    const ids = roster.map((player) => player.id);
    expect(parsePlayerSelection(undefined, ids)).toBeUndefined();
    expect(parsePlayerSelection(null, ids)).toBeNull();
    expect(parsePlayerSelection(["b", "b"], ids)).toEqual(["b"]);
    // Tout cocher = tout l'effectif, y compris les joueurs ajoutés plus tard.
    expect(parsePlayerSelection(["c", "a", "b"], ids)).toBeNull();
  });

  it("refuse une liste vide, invalide ou hors effectif", () => {
    const ids = roster.map((player) => player.id);
    expect(() => parsePlayerSelection([], ids)).toThrow("Coche au moins un joueur.");
    expect(() => parsePlayerSelection("a", ids)).toThrow("Liste de joueurs invalide.");
    expect(() => parsePlayerSelection(["z"], ids)).toThrow("ne fait pas partie");
  });
});
