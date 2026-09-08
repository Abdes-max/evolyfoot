import { describe, expect, it } from "vitest";
import {
  assignPlayerToSlot,
  canFinalizeMatchPlan,
  clearSlot,
  createMatchPlan,
  formationForGameFormat,
  isLineupComplete,
  setCaptain,
  validateMatchPlan,
} from "./match";
import type { GameFormat } from "./team";

describe("formationForGameFormat", () => {
  it("produit exactement le nombre de postes du format de jeu, pour chaque format", () => {
    const formats: GameFormat[] = [4, 5, 6, 7, 8, 9, 10, 11];
    for (const format of formats) {
      expect(formationForGameFormat(format)).toHaveLength(format);
    }
  });

  it("place toujours un unique gardien", () => {
    for (const slots of [formationForGameFormat(8), formationForGameFormat(11)]) {
      expect(slots.filter((slot) => slot.role === "goalkeeper")).toHaveLength(1);
    }
  });

  it("attribue des identifiants de poste stables et uniques", () => {
    const slots = formationForGameFormat(8);
    expect(new Set(slots.map((slot) => slot.id)).size).toBe(slots.length);
  });
});

describe("createMatchPlan", () => {
  it("part d'une composition vide, sans capitaine, au statut programmé", () => {
    const plan = createMatchPlan("US Vallée", "Samedi 12 septembre · 10:30", "home", 8);
    expect(plan.lineup).toHaveLength(0);
    expect(plan.captainPlayerId).toBeNull();
    expect(plan.status).toBe("scheduled");
  });

  it("nettoie les espaces superflus de l'adversaire et de la date", () => {
    const plan = createMatchPlan("  US Vallée  ", "  Samedi  ", "home", 8);
    expect(plan.opponent).toBe("US Vallée");
    expect(plan.dateLabel).toBe("Samedi");
  });
});

describe("assignPlayerToSlot", () => {
  const player = { id: "player-1", name: "Lina" };

  it("place un joueur sur un poste", () => {
    const plan = assignPlayerToSlot(createMatchPlan("US Vallée", "Samedi", "home", 4), "goalkeeper-1", player);
    expect(plan.lineup).toEqual([{ slotId: "goalkeeper-1", playerId: "player-1", playerName: "Lina" }]);
  });

  it("déplace le joueur si un autre poste lui est ensuite assigné, sans le dupliquer", () => {
    let plan = assignPlayerToSlot(createMatchPlan("US Vallée", "Samedi", "home", 4), "goalkeeper-1", player);
    plan = assignPlayerToSlot(plan, "defender-1", player);
    expect(plan.lineup).toEqual([{ slotId: "defender-1", playerId: "player-1", playerName: "Lina" }]);
  });

  it("remplace le joueur déjà présent sur un poste plutôt que de l'ajouter en double", () => {
    let plan = assignPlayerToSlot(createMatchPlan("US Vallée", "Samedi", "home", 4), "goalkeeper-1", player);
    plan = assignPlayerToSlot(plan, "goalkeeper-1", { id: "player-2", name: "Noah" });
    expect(plan.lineup).toEqual([{ slotId: "goalkeeper-1", playerId: "player-2", playerName: "Noah" }]);
  });
});

describe("clearSlot", () => {
  it("retire l'affectation d'un poste", () => {
    let plan = assignPlayerToSlot(createMatchPlan("US Vallée", "Samedi", "home", 4), "goalkeeper-1", { id: "p1", name: "Lina" });
    plan = clearSlot(plan, "goalkeeper-1");
    expect(plan.lineup).toHaveLength(0);
  });

  it("retire le titre de capitaine si le joueur retiré l'était", () => {
    let plan = assignPlayerToSlot(createMatchPlan("US Vallée", "Samedi", "home", 4), "goalkeeper-1", { id: "p1", name: "Lina" });
    plan = setCaptain(plan, "p1");
    plan = clearSlot(plan, "goalkeeper-1");
    expect(plan.captainPlayerId).toBeNull();
  });

  it("laisse le capitaine intact si un autre poste est vidé", () => {
    let plan = assignPlayerToSlot(createMatchPlan("US Vallée", "Samedi", "home", 4), "goalkeeper-1", { id: "p1", name: "Lina" });
    plan = assignPlayerToSlot(plan, "defender-1", { id: "p2", name: "Noah" });
    plan = setCaptain(plan, "p1");
    plan = clearSlot(plan, "defender-1");
    expect(plan.captainPlayerId).toBe("p1");
  });
});

describe("isLineupComplete / validateMatchPlan / canFinalizeMatchPlan", () => {
  it("est incomplète tant que tous les postes ne sont pas pourvus", () => {
    const plan = assignPlayerToSlot(createMatchPlan("US Vallée", "Samedi", "home", 4), "goalkeeper-1", { id: "p1", name: "Lina" });
    expect(isLineupComplete(plan)).toBe(false);
    expect(validateMatchPlan(plan).lineup).toBeDefined();
    expect(canFinalizeMatchPlan(plan)).toBe(false);
  });

  it("exige un capitaine parmi les titulaires même une fois la composition complète", () => {
    let plan = createMatchPlan("US Vallée", "Samedi", "home", 4);
    const slots = formationForGameFormat(4);
    slots.forEach((slot, index) => {
      plan = assignPlayerToSlot(plan, slot.id, { id: `p${index}`, name: `Joueur ${index}` });
    });
    expect(isLineupComplete(plan)).toBe(true);
    expect(validateMatchPlan(plan).captain).toBeDefined();
    expect(canFinalizeMatchPlan(plan)).toBe(false);

    plan = setCaptain(plan, "p0");
    expect(canFinalizeMatchPlan(plan)).toBe(true);
    expect(validateMatchPlan(plan)).toEqual({});
  });

  it("exige un adversaire et une date", () => {
    let plan = createMatchPlan("", "", "home", 4);
    const errors = validateMatchPlan(plan);
    expect(errors.opponent).toBeDefined();
    expect(errors.dateLabel).toBeDefined();
  });
});
