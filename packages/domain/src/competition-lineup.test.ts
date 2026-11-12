import { describe, expect, it } from "vitest";
import {
  changeCompetitionFormation,
  emptyCompetitionLineup,
  lineupFromTemplate,
  parseCompetitionLineup,
  restrictLineupToPlayers,
  validateCompetitionLineup,
} from "./competition-lineup";
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

  it("compo type : banc de 6, puis reprise pour une journée sans les joueurs non concernés", () => {
    const lineup = [{ slotId: first!.id, playerId: "p1", playerName: "Léo" }];
    const bench = ["b1", "b2", "b3", "b4", "b5", "b6"];
    expect(validateCompetitionLineup({ ...base, lineup, substitutePlayerIds: bench }, 6)).toBeNull();
    expect(validateCompetitionLineup({ ...base, lineup, substitutePlayerIds: bench })).toMatch(/remplaçants au plus/);
    const day = lineupFromTemplate({ ...base, lineup, captainPlayerId: "p1", substitutePlayerIds: bench }, new Set(["b1", "b2", "b3", "b4", "b5"]));
    expect(day.lineup).toHaveLength(0);
    expect(day.captainPlayerId).toBeNull();
    expect(validateCompetitionLineup(day)).toBeNull();
  });

  it("retire de la compo les joueurs qui ne sont plus concernés", () => {
    const lineup = [
      { slotId: first!.id, playerId: "p1", playerName: "Léo" },
      { slotId: second!.id, playerId: "p2", playerName: "Noé" },
    ];
    const restricted = restrictLineupToPlayers({ ...base, lineup, captainPlayerId: "p2", substitutePlayerIds: ["p3", "p4"] }, new Set(["p1", "p3"]));
    expect(restricted.lineup.map((assignment) => assignment.playerId)).toEqual(["p1"]);
    expect(restricted.captainPlayerId).toBeNull();
    expect(restricted.substitutePlayerIds).toEqual(["p3"]);
  });

  it("reporte les titulaires sur la nouvelle formation", () => {
    const lineup = formationSlots(5, base.formationId).map((slot, index) => ({ slotId: slot.id, playerId: `p${index}`, playerName: `J${index}` }));
    const smaller = changeCompetitionFormation({ ...base, lineup }, 4, listFormations(4)[0]!.id);
    expect(smaller.lineup).toHaveLength(formationSlots(4).length);
    expect(smaller.substitutePlayerIds).toHaveLength(lineup.length - formationSlots(4).length);
    expect(validateCompetitionLineup(smaller)).toBeNull();
  });
});
