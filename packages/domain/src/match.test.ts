import { describe, expect, it } from "vitest";
import {
  addSubstitute,
  assignPlayerToSlot,
  canFinalizeMatchPlan,
  changeFormation,
  clearSlot,
  createMatchPlan,
  defaultFormationId,
  formationSlots,
  isLineupComplete,
  listFormations,
  removeSubstitute,
  setCaptain,
  validateMatchPlan,
} from "./match";
import type { GameFormat } from "./team";

describe("listFormations", () => {
  it("propose plusieurs formations pour chaque format de jeu", () => {
    const formats: GameFormat[] = [4, 5, 6, 7, 8, 9, 10, 11];
    for (const format of formats) {
      expect(listFormations(format).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("chaque formation totalise exactement le nombre de postes du format de jeu", () => {
    const formats: GameFormat[] = [4, 5, 6, 7, 8, 9, 10, 11];
    for (const format of formats) {
      for (const formation of listFormations(format)) {
        expect(formation.slots).toHaveLength(format);
      }
    }
  });

  it("place toujours un unique gardien par formation", () => {
    for (const formation of listFormations(8)) {
      expect(formation.slots.filter((slot) => slot.role === "goalkeeper")).toHaveLength(1);
    }
  });

  it("attribue des identifiants de poste stables et uniques au sein d'une formation", () => {
    for (const formation of listFormations(11)) {
      expect(new Set(formation.slots.map((slot) => slot.id)).size).toBe(formation.slots.length);
    }
  });
});

describe("formationSlots", () => {
  it("retourne les postes de la formation demandée", () => {
    const formations = listFormations(8);
    const second = formations[1]!;
    expect(formationSlots(8, second.id)).toEqual(second.slots);
  });

  it("se replie sur la première formation si l'identifiant est absent ou inconnu", () => {
    const first = listFormations(8)[0]!;
    expect(formationSlots(8, undefined)).toEqual(first.slots);
    expect(formationSlots(8, "formation-inexistante")).toEqual(first.slots);
  });
});

describe("createMatchPlan", () => {
  it("part d'une composition vide, sans capitaine, au statut programmé, avec la formation par défaut", () => {
    const plan = createMatchPlan("US Vallée", "Samedi 12 septembre · 10:30", "home", 8);
    expect(plan.lineup).toHaveLength(0);
    expect(plan.captainPlayerId).toBeNull();
    expect(plan.status).toBe("scheduled");
    expect(plan.formationId).toBe(defaultFormationId(8));
  });

  it("accepte une formation explicite", () => {
    const chosen = listFormations(8)[1]!;
    const plan = createMatchPlan("US Vallée", "Samedi", "home", 8, chosen.id);
    expect(plan.formationId).toBe(chosen.id);
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

describe("changeFormation", () => {
  it("vide la composition et le capitaine, les postes n'étant plus les mêmes", () => {
    let plan = assignPlayerToSlot(createMatchPlan("US Vallée", "Samedi", "home", 8), "goalkeeper-1", { id: "p1", name: "Lina" });
    plan = setCaptain(plan, "p1");
    const nextFormation = listFormations(8)[1]!;

    plan = changeFormation(plan, nextFormation.id);

    expect(plan.formationId).toBe(nextFormation.id);
    expect(plan.lineup).toHaveLength(0);
    expect(plan.captainPlayerId).toBeNull();
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
    const slots = formationSlots(4, plan.formationId);
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

describe("addSubstitute / removeSubstitute", () => {
  const player = { id: "player-1", name: "Lina" };

  it("place un joueur sur le banc", () => {
    const plan = addSubstitute(createMatchPlan("US Vallée", "Samedi", "home", 4), player);
    expect(plan.substitutePlayerIds).toEqual(["player-1"]);
  });

  it("ne duplique pas un joueur déjà sur le banc", () => {
    let plan = addSubstitute(createMatchPlan("US Vallée", "Samedi", "home", 4), player);
    plan = addSubstitute(plan, player);
    expect(plan.substitutePlayerIds).toEqual(["player-1"]);
  });

  it("retire le joueur de son poste (et du capitanat) en le mettant sur le banc", () => {
    let plan = assignPlayerToSlot(createMatchPlan("US Vallée", "Samedi", "home", 4), "goalkeeper-1", player);
    plan = setCaptain(plan, "player-1");
    plan = addSubstitute(plan, player);
    expect(plan.lineup).toHaveLength(0);
    expect(plan.captainPlayerId).toBeNull();
    expect(plan.substitutePlayerIds).toEqual(["player-1"]);
  });

  it("retire un joueur du banc en l'affectant à un poste", () => {
    let plan = addSubstitute(createMatchPlan("US Vallée", "Samedi", "home", 4), player);
    plan = assignPlayerToSlot(plan, "goalkeeper-1", player);
    expect(plan.substitutePlayerIds).toEqual([]);
    expect(plan.lineup).toEqual([{ slotId: "goalkeeper-1", playerId: "player-1", playerName: "Lina" }]);
  });

  it("retire un joueur du banc", () => {
    let plan = addSubstitute(createMatchPlan("US Vallée", "Samedi", "home", 4), player);
    plan = removeSubstitute(plan, "player-1");
    expect(plan.substitutePlayerIds).toEqual([]);
  });
});
