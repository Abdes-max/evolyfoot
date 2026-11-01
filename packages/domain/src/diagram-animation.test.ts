import { describe, expect, it } from "vitest";
import { buildDiagramAnimation, diagramAnimationStepCount } from "./diagram-animation";
import { buildDiagram, trainingActivityCatalogue } from "./training-session";

describe("animation d'un schéma", () => {
  it("rejoue toujours la même séquence pour un même exercice", () => {
    const diagram = buildDiagram("main", 1, false);

    expect(buildDiagramAnimation(diagram, "main-a")).toEqual(buildDiagramAnimation(diagram, "main-a"));
    expect(buildDiagramAnimation(diagram, "main-a")).not.toEqual(buildDiagramAnimation(diagram, "main-b"));
  });

  it("anime tout le catalogue sans sortir les joueurs de leur zone", () => {
    for (const activity of trainingActivityCatalogue) {
      const steps = buildDiagramAnimation(activity.diagram, activity.id);
      expect(steps).toHaveLength(diagramAnimationStepCount);
      const fieldPlayers = activity.diagram.tokens.filter((token) => token.role !== "goalkeeper");
      for (const step of steps) {
        for (const token of fieldPlayers) {
          const point = step.to[token.id]!;
          const inside = activity.diagram.zones.some(
            (zone) => point.x >= zone.x && point.x <= zone.x + zone.width && point.y >= zone.y && point.y <= zone.y + zone.height,
          );
          expect(inside, `${activity.id} ${token.id}`).toBe(true);
        }
      }
    }
  });

  it("enchaîne les passes entre partenaires, un porteur après l'autre", () => {
    const diagram = buildDiagram("welcome", 1, false);
    const steps = buildDiagramAnimation(diagram, "welcome-a");
    const attackers = new Set(diagram.tokens.filter((token) => token.role === "attacker").map((token) => token.id));

    steps.forEach((step, index) => {
      const pass = step.passes[0]!;
      expect(attackers.has(pass.toId)).toBe(true);
      expect(pass.toId).not.toBe(pass.fromId);
      if (index > 0) {
        expect(pass.fromId).toBe(steps[index - 1]!.passes[0]!.toId);
      }
    });
  });

  it("envoie le défenseur le plus proche sur le receveur", () => {
    const diagram = buildDiagram("welcome", 1, false);
    const [step] = buildDiagramAnimation(diagram, "welcome-a");
    const press = step!.pressers[0]!;

    const before = Math.hypot(step!.from[press.id]!.x - step!.to[press.targetId]!.x, step!.from[press.id]!.y - step!.to[press.targetId]!.y);
    const after = Math.hypot(step!.to[press.id]!.x - step!.to[press.targetId]!.x, step!.to[press.id]!.y - step!.to[press.targetId]!.y);
    expect(after).toBeLessThan(before);
  });

  it("n'annonce pas de pressing sans défenseur", () => {
    const steps = buildDiagramAnimation(buildDiagram("activation", 0, false), "activation-a");

    expect(steps.flatMap((step) => step.pressers)).toEqual([]);
    expect(steps[0]!.caption).toBe("Passe et déplacement");
  });
});
