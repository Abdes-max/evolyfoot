import { describe, expect, it } from "vitest";
import { changeCompetitionFormation, emptyCompetitionLineup, parseCompetitionLineup, validateCompetitionLineup } from "./competition-lineup";
import { formationSlots, listFormations } from "./match";

describe("composition d'un tournoi ou d'un plateau", () => {
  const base = emptyCompetitionLineup(5);
  const [first, second] = formationSlots(5, base.formationId);

  it("relit une valeur enregistrée et refuse une forme inconnue", () => {
    expect(parseCompetitionLineup(null)).toBeNull();
    expect(parseCompetitionLineup({ gameFormat: 3, formationId: "x" })).toBeNull();
    expect(parseCompetitionLineup({ ...base, lineup: [{ slotId: first!.id, playerId: "p1", playerName: "Léo" }, { bad: true }] })?.lineup).toHaveLength(1);
  });

  it("valide postes, capitaine et banc", () => {
    const lineup = [{ slotId: first!.id, playerId: "p1", playerName: "Léo" }];
    expect(validateCompetitionLineup({ ...base, lineup, captainPlayerId: "p1", substitutePlayerIds: ["p2"] })).toBeNull();
    expect(validateCompetitionLineup({ ...base, formationId: "inconnue" })).toMatch(/formation/);
    expect(validateCompetitionLineup({ ...base, lineup: [...lineup, { slotId: second!.id, playerId: "p1", playerName: "Léo" }] })).toMatch(/seul poste/);
    expect(validateCompetitionLineup({ ...base, lineup, captainPlayerId: "p2" })).toMatch(/capitaine/);
    expect(validateCompetitionLineup({ ...base, lineup, substitutePlayerIds: ["p1"] })).toMatch(/titulaire et remplaçant/);
  });

  it("reporte les titulaires sur la nouvelle formation", () => {
    const lineup = formationSlots(5, base.formationId).map((slot, index) => ({ slotId: slot.id, playerId: `p${index}`, playerName: `J${index}` }));
    const smaller = changeCompetitionFormation({ ...base, lineup }, 4, listFormations(4)[0]!.id);
    expect(smaller.lineup).toHaveLength(formationSlots(4).length);
    expect(smaller.substitutePlayerIds).toHaveLength(lineup.length - formationSlots(4).length);
    expect(validateCompetitionLineup(smaller)).toBeNull();
  });
});
