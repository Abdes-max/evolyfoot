import { describe, expect, it } from "vitest";
import { listFormations } from "./match";
import { analyzeMatchup } from "./tactical-analysis";
import { gameFormats } from "./team";

describe("analyse d'un match par systèmes de jeu", () => {
  it("compare les joueurs ligne par ligne", () => {
    const { lines } = analyzeMatchup(11, "4-3-3", "4-4-2");

    expect(lines.map((line) => [line.id, line.ours, line.theirs, line.balance])).toEqual([
      ["midfield", 3, 4, "disadvantage"],
      ["attack", 3, 4, "disadvantage"],
      ["defense", 4, 2, "advantage"],
    ]);
  });

  it("oriente la préparation vers la récupération quand le milieu est en infériorité", () => {
    const analysis = analyzeMatchup(11, "4-3-3", "4-4-2");

    expect(analysis.theme).toBe("Récupérer rapidement");
    expect(analysis.exercises.length).toBeGreaterThan(0);
    expect(analysis.exercises.every((activity) => activity.kind === "main" && activity.compatibleThemes.includes("Récupérer rapidement"))).toBe(true);
  });

  it("oriente vers la conservation avec un surnombre au milieu", () => {
    expect(analyzeMatchup(11, "3-5-2", "4-3-3").theme).toBe("Conserver le ballon");
  });

  it("couvre tous les systèmes de tous les formats", () => {
    for (const format of gameFormats) {
      for (const ours of listFormations(format)) {
        for (const theirs of listFormations(format)) {
          const analysis = analyzeMatchup(format, ours.id, theirs.id);
          expect(analysis.lines).toHaveLength(3);
          expect(analysis.exercises.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
