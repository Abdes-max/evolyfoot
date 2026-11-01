import { describe, expect, it } from "vitest";
import { isPersonalActivityId, parseExerciseText, personalExerciseToActivity, validatePersonalExercise, type PersonalExerciseInput } from "./personal-exercise";
import { replaceBlockActivity, replaceSessionActivity, generateTrainingSession } from "./training-session";
import { rehydrateTrainingSession } from "./training-calendar";

const input: PersonalExerciseInput = {
  kind: "main",
  theme: "Conserver le ballon",
  title: "Mon rondo",
  objective: "Garder le ballon",
  organization: "Carré de 12m",
  instruction: "Deux touches",
  observable: "Deux solutions",
  photo: null,
};
const week = { week: 1, phase: "Découvrir" as const, theme: "Conserver le ballon" as const, intention: "Intention", observable: "Repère" };

describe("exercices personnels", () => {
  it("valide la fiche", () => {
    expect(validatePersonalExercise(input)).toBeNull();
    expect(validatePersonalExercise({ ...input, title: "  " })).not.toBeNull();
    expect(validatePersonalExercise({ ...input, photo: "https://exemple.test/image.png" })).not.toBeNull();
  });

  it("devient une activité utilisable dans une séance", () => {
    const activity = personalExerciseToActivity({ ...input, id: "abc" });

    expect(activity.id).toBe("perso-abc");
    expect(isPersonalActivityId(activity.id)).toBe(true);
    expect(activity.diagram.zones.length).toBeGreaterThan(0);
  });

  it("remplace un bloc sans changer son identifiant ni sa durée", () => {
    const session = generateTrainingSession(week, "U12", 14);
    const activity = personalExerciseToActivity({ ...input, id: "abc" });
    const updated = replaceBlockActivity(session, 2, activity);

    expect(updated.blocks[2]?.activity.id).toBe("perso-abc");
    expect(updated.blocks[2]?.id).toBe(session.blocks[2]?.id);
    expect(updated.blocks[2]?.durationMinutes).toBe(session.blocks[2]?.durationMinutes);
    expect(replaceSessionActivity(updated, 2).blocks[2]?.activity.id).not.toBe("perso-abc");
  });

  it("recharge une séance contenant un exercice personnel", () => {
    const record = {
      id: "s1",
      title: "Séance",
      ageGroup: "U12" as const,
      playerCount: 14,
      theme: "Conserver le ballon" as const,
      intention: "Intention",
      blocks: [{ id: "b1", activityId: "perso-abc", durationMinutes: 20 }],
      weekNumber: 1,
      slot: 0,
    };

    expect(rehydrateTrainingSession(record)).toBeNull();
    expect(rehydrateTrainingSession(record, [{ ...input, id: "abc" }])?.blocks[0]?.activity.title).toBe("Mon rondo");
  });
});

describe("parseExerciseText", () => {
  it("reconnaît le titre et les champs annoncés", () => {
    const parsed = parseExerciseText("Rondo fédéral\nObjectif : garder le ballon\nOrganisation : carré de 10m\nsur herbe\nConsigne : deux touches\nÀ observer : le soutien");

    expect(parsed).toEqual({
      title: "Rondo fédéral",
      objective: "garder le ballon",
      organization: "carré de 10m sur herbe",
      instruction: "deux touches",
      observable: "le soutien",
    });
  });

  it("place un texte libre dans l'organisation", () => {
    expect(parseExerciseText("Mon jeu\nDeux équipes de cinq.").organization).toBe("Deux équipes de cinq.");
  });
});
