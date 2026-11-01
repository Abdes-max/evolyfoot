import { describe, expect, it } from "vitest";
import type { DevelopmentWeek } from "./development-plan";
import {
  adjustBlockDuration,
  canReplaceSessionActivity,
  canValidateSession,
  findTrainingActivity,
  explainTrainingSession,
  generateTrainingSession,
  getSessionDuration,
  moveSessionBlock,
  replaceSessionActivity,
  trainingActivityCatalogue,
} from "./training-session";

const developmentWeek: DevelopmentWeek = {
  week: 1,
  phase: "Découvrir",
  theme: "Progresser ensemble",
  intention: "Créer des relations pour avancer sans isoler le porteur.",
  observable: "Les joueurs identifient le comportement attendu.",
};

describe("training session generation", () => {
  it("génère quatre blocs totalisant 75 minutes", () => {
    const session = generateTrainingSession(developmentWeek, "U12", 14);

    expect(session.blocks.map((block) => block.activity.kind)).toEqual([
      "welcome",
      "activation",
      "main",
      "game",
    ]);
    expect(getSessionDuration(session)).toBe(75);
    expect(generateTrainingSession(developmentWeek, "U12", 14)).toEqual(session);
  });

  it.each([
    ["Conserver le ballon", "conserver"],
    ["Progresser ensemble", "progresser"],
    ["Finir les actions", "finir"],
    ["Récupérer rapidement", "recuperer"],
  ] as const)("propose des activités spécifiques au thème %s", (theme, idFragment) => {
    const themedWeek = { ...developmentWeek, theme };
    const themedSession = generateTrainingSession(themedWeek, "U12", 14);

    expect(themedSession.blocks).toHaveLength(4);
    expect(themedSession.blocks.every((block) => block.activity.id.includes(idFragment))).toBe(true);
    expect(themedSession.blocks.every((block) => block.activity.compatibleThemes.length === 1)).toBe(true);
  });

  it("crée des identifiants de blocs stables et rend une copie indépendante du catalogue", () => {
    const first = generateTrainingSession(developmentWeek, "U12", 14);
    const second = generateTrainingSession(developmentWeek, "U12", 14);

    expect(first.blocks.map((block) => block.id)).toEqual(second.blocks.map((block) => block.id));
    expect(new Set(first.blocks.map((block) => block.id)).size).toBe(4);
    first.blocks[0].activity.title = "Modification locale";
    first.blocks[0].activity.compatibleThemes.push("Finir les actions");

    expect(second.blocks[0].activity.title).not.toBe("Modification locale");
    expect(second.blocks[0].activity.compatibleThemes).toEqual(["Progresser ensemble"]);
  });
});

describe("variété et explication des séances générées", () => {
  const conserverWeek = { ...developmentWeek, theme: "Conserver le ballon" as const };
  const titles = (generated: ReturnType<typeof generateTrainingSession>) => generated.blocks.map((block) => block.activity.title);

  it("varie le déroulé entre deux créneaux d'une même semaine", () => {
    expect(titles(generateTrainingSession(conserverWeek, "U12", 14, 0))).not.toEqual(titles(generateTrainingSession(conserverWeek, "U12", 14, 1)));
  });

  it("propose une autre séance sur le même créneau avec un identifiant distinct", () => {
    const first = generateTrainingSession(conserverWeek, "U12", 14, 0);
    const other = generateTrainingSession(conserverWeek, "U12", 14, 0, 1);

    expect(titles(other)).not.toEqual(titles(first));
    expect(other.id).not.toBe(first.id);
    expect(generateTrainingSession(conserverWeek, "U12", 14, 0, 1)).toEqual(other);
  });

  it("explique la séance et chaque bloc", () => {
    const generated = generateTrainingSession(conserverWeek, "U12", 15, 0);
    const explanation = explainTrainingSession(generated, conserverWeek);

    expect(explanation.summary).toContain("Découvrir");
    expect(explanation.summary).toContain("Conserver le ballon");
    expect(explanation.blocks.map((block) => block.blockId)).toEqual(generated.blocks.map((block) => block.id));
    expect(explanation.blocks[2]?.reason).toContain("deux groupes de 7 et 8");
  });
});

const session = generateTrainingSession(developmentWeek, "U12", 14);

describe("training session editing", () => {
  it("édite une séance sans muter la proposition", () => {
    const longer = adjustBlockDuration(session, 0, 5);

    expect(getSessionDuration(longer)).toBe(80);
    expect(getSessionDuration(session)).toBe(75);
    expect(adjustBlockDuration(session, 0, -10).blocks[0].durationMinutes).toBe(5);
    expect(adjustBlockDuration(session, 0, -15).blocks[0].durationMinutes).toBe(5);
  });

  it.each([0, 4, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "ignore un ajustement invalide de %s minute(s)",
    (delta) => {
      expect(adjustBlockDuration(session, 0, delta)).toBe(session);
    },
  );

  it("réordonne et remplace avec une activité compatible", () => {
    expect(moveSessionBlock(session, 0, 1).blocks[1].activity.kind).toBe("welcome");
    expect(moveSessionBlock(session, 0, -1)).toEqual(session);

    const replacement = replaceSessionActivity(session, 2);

    expect(replacement.blocks[2].activity.id).not.toBe(session.blocks[2].activity.id);
    expect(replacement.blocks[2].activity.compatibleThemes).toContain(session.theme);
    expect(replacement.blocks[2].id).toBe(session.blocks[2].id);
    expect(canReplaceSessionActivity(session, 2)).toBe(true);
    expect(canReplaceSessionActivity(session, 0)).toBe(true);
    expect(replaceSessionActivity(session, 0).blocks[0].activity.id).not.toBe(session.blocks[0].activity.id);
  });

  it("valide uniquement une durée totale entre 60 et 90 minutes", () => {
    const sixty = adjustBlockDuration(session, 2, -15);
    const ninety = adjustBlockDuration(session, 2, 15);
    const belowSixty = adjustBlockDuration(sixty, 0, -5);
    const aboveNinety = adjustBlockDuration(ninety, 0, 5);

    expect(getSessionDuration(sixty)).toBe(60);
    expect(getSessionDuration(ninety)).toBe(90);
    expect(canValidateSession(sixty)).toBe(true);
    expect(canValidateSession(ninety)).toBe(true);
    expect(canValidateSession(belowSixty)).toBe(false);
    expect(canValidateSession(aboveNinety)).toBe(false);
  });
});

describe("bibliothèque d'exercices", () => {
  it("expose vingt activités, chacune avec un schéma tactique et un contenu de coaching complet", () => {
    expect(trainingActivityCatalogue).toHaveLength(100);
    expect(new Set(trainingActivityCatalogue.map((activity) => activity.id)).size).toBe(100);
    expect(new Set(trainingActivityCatalogue.map((activity) => activity.title)).size).toBe(100);

    for (const activity of trainingActivityCatalogue) {
      expect(activity.rules.length).toBeGreaterThan(0);
      expect(activity.coachingPoints.length).toBeGreaterThan(0);
      expect(activity.equipment.length).toBeGreaterThan(0);
      expect(activity.fieldSize.length).toBeGreaterThan(0);
      expect(activity.diagram.tokens.length).toBeGreaterThan(0);

      const defenderTokenCount = activity.diagram.tokens.filter((token) => token.role === "defender").length;
      expect(defenderTokenCount).toBeGreaterThanOrEqual(activity.defenderCount);
      expect(activity.diagram.tokens.some((token) => token.role === "goalkeeper")).toBe(activity.hasGoalkeeper);

      for (const token of activity.diagram.tokens) {
        expect(token.x).toBeGreaterThanOrEqual(0);
        expect(token.x).toBeLessThanOrEqual(activity.diagram.width);
        expect(token.y).toBeGreaterThanOrEqual(0);
        expect(token.y).toBeLessThanOrEqual(activity.diagram.height);
      }
    }
  });

  it("retrouve une activité par identifiant et rend indéfini pour un identifiant inconnu", () => {
    const activity = findTrainingActivity("welcome-recuperer");

    expect(activity?.title).toBe("Accueil chasse au ballon");
    expect(findTrainingActivity("inconnu")).toBeUndefined();
  });
});
