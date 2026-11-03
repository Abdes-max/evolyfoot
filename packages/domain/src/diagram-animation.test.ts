import { describe, expect, it } from "vitest";
import { buildDiagramAnimation, diagramAnimationStepCount, diagramTargets, exerciseScenario, targetGeometry } from "./diagram-animation";
import { trainingActivityCatalogue, type TrainingActivity } from "./training-session";

function exercise(title: string): TrainingActivity {
  const found = trainingActivityCatalogue.find((activity) => activity.title === title);
  if (!found) {
    throw new Error(`Exercice introuvable : ${title}`);
  }
  return found;
}

function animate(activity: TrainingActivity) {
  return buildDiagramAnimation(activity, activity.id);
}

describe("animation d'un exercice", () => {
  it("rejoue toujours la même séquence pour un même exercice", () => {
    const activity = exercise("Rondo mobile 4 contre 1");

    expect(buildDiagramAnimation(activity, "a")).toEqual(buildDiagramAnimation(activity, "a"));
    expect(buildDiagramAnimation(activity, "a")).not.toEqual(buildDiagramAnimation(activity, "b"));
  });

  it("anime tout le catalogue avec un ballon à chaque étape, sans sortir les joueurs de leur zone", () => {
    for (const activity of trainingActivityCatalogue) {
      const steps = animate(activity);
      expect(steps).toHaveLength(diagramAnimationStepCount);
      const fieldPlayers = activity.diagram.tokens.filter((token) => token.role !== "goalkeeper");
      for (const step of steps) {
        expect(step.balls.length, activity.id).toBeGreaterThan(0);
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

  it("légende chaque étape avec la consigne, les règles et les points de la fiche", () => {
    for (const activity of trainingActivityCatalogue) {
      const texts = [activity.instruction, ...activity.rules, ...activity.coachingPoints, activity.observable];
      const captions = animate(activity).map((step) => step.caption);
      expect(captions[0]).toBe(activity.instruction);
      for (const caption of captions) {
        expect(texts, activity.id).toContain(caption);
      }
      expect(new Set(captions).size, activity.id).toBe(diagramAnimationStepCount);
    }
  });

  it("déduit le scénario de la fiche", () => {
    expect(exerciseScenario(exercise("Rondo mobile 4 contre 1"))).toBe("possession");
    expect(exerciseScenario(exercise("Passes en étoile"))).toBe("passAndMove");
    expect(exerciseScenario(exercise("Conduite et accélération"))).toBe("dribbling");
    expect(exerciseScenario(exercise("Franchir les trois lignes"))).toBe("progression");
    expect(exerciseScenario(exercise("Le 2 contre 1 en couloir"))).toBe("progression");
    expect(exerciseScenario(exercise("Accueil conduite et frappe"))).toBe("finishing");
    expect(exerciseScenario(exercise("Match bonus conservation"))).toBe("finishing");
    expect(exerciseScenario(exercise("Duel et contre-pression"))).toBe("pressing");
    expect(exerciseScenario(exercise("Possession avec appuis extérieurs"))).toBe("possession");
    expect(exerciseScenario(exercise("Le triangle qui avance"))).toBe("progression");
    expect(exerciseScenario(exercise("Contre-attaque à trois"))).toBe("finishing");
    expect(exerciseScenario(exercise("Match en supériorité tournante"))).toBe("finishing");
    expect(exerciseScenario(exercise("Match avec joker offensif"))).toBe("finishing");
  });

  it("passe et suit : le ballon va au partenaire suivant et le passeur suit sa passe", () => {
    const steps = animate(exercise("Passes en étoile"));

    steps.forEach((step, index) => {
      const pass = step.balls[0]!;
      expect(pass.kind).toBe("pass");
      expect(pass.toId).not.toBe(pass.fromId);
      if (index > 0) {
        expect(pass.fromId).toBe(steps[index - 1]!.balls[0]!.toId);
      }
      const receiver = step.from[pass.toId!]!;
      const before = Math.hypot(step.from[pass.fromId]!.x - receiver.x, step.from[pass.fromId]!.y - receiver.y);
      const after = Math.hypot(step.to[pass.fromId]!.x - receiver.x, step.to[pass.fromId]!.y - receiver.y);
      expect(after).toBeLessThan(before);
    });
    expect(steps.flatMap((step) => step.pressers)).toEqual([]);
  });

  it("conduite : chaque joueur avance balle au pied jusqu'à la ligne, puis revient", () => {
    const activity = exercise("Conduite et accélération");
    const steps = animate(activity);
    const attackers = activity.diagram.tokens.filter((token) => token.role === "attacker");

    for (const step of steps) {
      expect(step.balls.every((ball) => ball.kind === "dribble")).toBe(true);
      expect(step.balls).toHaveLength(attackers.length);
    }
    for (const attacker of attackers) {
      expect(steps[2]!.to[attacker.id]!.x).toBeGreaterThan(attacker.x);
      expect(steps[5]!.to[attacker.id]).toEqual({ x: attacker.x, y: attacker.y });
    }
  });

  it("finition : l'action se termine par un tir vers le but, deux fois", () => {
    const steps = animate(exercise("Finir une attaque à trois"));

    expect(steps.map((step) => step.balls.some((ball) => ball.kind === "shot"))).toEqual([false, false, true, false, false, true]);
    const shot = steps[2]!.balls.find((ball) => ball.kind === "shot")!;
    expect(shot.target).not.toBeNull();
    expect(steps[2]!.caption).toMatch(/frappe|tir|but|fini/i);
  });

  it("pressing : le défenseur le plus proche presse, récupère, puis l'équipe repart", () => {
    const activity = exercise("Duel et contre-pression");
    const steps = animate(activity);
    const defenders = new Set(activity.diagram.tokens.filter((token) => token.role === "defender").map((token) => token.id));

    expect(steps[1]!.pressers.length).toBeGreaterThan(0);
    const steal = steps[2]!.balls.find((ball) => ball.kind === "steal")!;
    expect(defenders.has(steal.toId!)).toBe(true);
    expect(steps[3]!.pressers.some((press) => !defenders.has(press.id))).toBe(true);
  });

  it("dessine une cible pour chaque exercice qui vise un but, une porte ou une ligne", () => {
    for (const activity of trainingActivityCatalogue) {
      const scenario = exerciseScenario(activity);
      const targets = diagramTargets(activity);
      if (scenario === "finishing" || scenario === "progression") {
        expect(targets.length, activity.id).toBeGreaterThan(0);
      }
      if (scenario === "finishing") {
        expect(
          targets.some((target) => target.kind === "goal" || target.kind === "miniGoal"),
          activity.id,
        ).toBe(true);
      }
      for (const target of targets) {
        for (const point of Object.values(targetGeometry(target))) {
          expect(
            point.x >= 4 && point.x <= activity.diagram.width - 4 && point.y >= 4 && point.y <= activity.diagram.height - 4,
            `${activity.id} ${target.kind}`,
          ).toBe(true);
        }
      }
    }
    const kinds = (title: string) =>
      diagramTargets(exercise(title))
        .filter((target) => target.kind !== "cone" && target.kind !== "plot")
        .map((target) => target.kind);
    expect(kinds("Match à trois passes")).toEqual(["miniGoal", "miniGoal"]);
    expect(kinds("Le 3 contre 2 vers les portes")).toEqual(["gate", "gate", "gate", "gate"]);
    expect(kinds("Les rois de la ligne")).toEqual(["line"]);
    expect(kinds("Rondo mobile 4 contre 1")).toEqual([]);
  });

  it("dessine les cônes et les plots de l'organisation", () => {
    const cones = (title: string) => diagramTargets(exercise(title)).filter((target) => target.kind === "cone" || target.kind === "plot");
    const star = exercise("Passes en étoile");

    // Zone délimitée aux quatre coins : par des cônes si la fiche en prévoit, sinon par des plots.
    expect(cones("Rondo mobile 4 contre 1").map((target) => target.kind)).toEqual(["cone", "cone", "cone", "cone"]);
    expect(cones("Passes en étoile").every((target) => target.kind === "plot")).toBe(true);
    expect(diagramTargets({ ...exercise("Rondo mobile 4 contre 1"), equipment: ["Chasubles"] })).toEqual([]);
    // Un plot par joueur en étoile, un plot central, une ligne de plots pour le slalom.
    expect(cones("Passes en étoile")).toHaveLength(4 + star.diagram.tokens.filter((token) => token.role === "attacker").length);
    expect(cones("Les passes croisées")).toHaveLength(5);
    expect(cones("Le slalom à deux")).toHaveLength(4 + 5);
    expect(cones("Conduite et accélération")).toHaveLength(4 + 8);
  });

  it("tire dans la cage dessinée", () => {
    for (const activity of trainingActivityCatalogue.filter((candidate) => exerciseScenario(candidate) === "finishing")) {
      const goals = diagramTargets(activity).filter((target) => target.kind === "goal" || target.kind === "miniGoal");
      for (const step of animate(activity)) {
        for (const shot of step.balls.filter((ball) => ball.kind === "shot")) {
          const inside = goals.some((goal) => {
            const { a, b } = targetGeometry(goal);
            return Math.hypot(shot.target!.x - a.x, shot.target!.y - a.y) + Math.hypot(shot.target!.x - b.x, shot.target!.y - b.y) <= goal.width + 0.01;
          });
          expect(inside, activity.id).toBe(true);
        }
      }
    }
  });

  it("garde un ballon et des légendes pour une fiche sans texte ni défenseur", () => {
    const base = exercise("Passes en étoile");
    const steps = buildDiagramAnimation({ ...base, instruction: "", rules: [], coachingPoints: [], observable: "" }, "vide");

    expect(steps.every((step) => step.caption.length > 0)).toBe(true);
    expect(steps.every((step) => step.balls.length > 0)).toBe(true);
  });
});
