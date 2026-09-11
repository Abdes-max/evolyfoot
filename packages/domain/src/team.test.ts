import { describe, expect, it } from "vitest";
import { createTeamProfile, sortTrainingDays, validateTeamProfile } from "./team";
const validTeam = { name: "FC Horizon", ageGroup: "U12" as const, gameFormat: 8 as const, playerCount: 14, sessionsPerWeek: 2, trainingDays: ["Mardi", "Jeudi"] as const };
describe("team profile", () => {
  it("normalise une équipe valide", () => expect(createTeamProfile({ ...validTeam, name: "  FC Horizon  ", trainingDays: [...validTeam.trainingDays] })).toEqual(validTeam));
  it("signale les incohérences", () => { const errors = validateTeamProfile({ ...validTeam, playerCount: 4, trainingDays: ["Mardi"] }); expect(errors.playerCount).toMatch(/6 et 30/); expect(errors.trainingDays).toMatch(/chaque séance/); });
  it("signale un format de jeu invalide", () => { const errors = validateTeamProfile({ ...validTeam, gameFormat: 3 as unknown as (typeof validTeam)["gameFormat"], trainingDays: [...validTeam.trainingDays] }); expect(errors.gameFormat).toMatch(/foot à 4 au foot à 11/); });
  it("trie les jours d'entraînement dans l'ordre chronologique de la semaine, quel que soit l'ordre de saisie", () => {
    expect(sortTrainingDays(["Mercredi", "Vendredi", "Mardi"])).toEqual(["Mardi", "Mercredi", "Vendredi"]);
    expect(createTeamProfile({ ...validTeam, sessionsPerWeek: 3, trainingDays: ["Vendredi", "Lundi", "Mercredi"] }).trainingDays).toEqual([
      "Lundi",
      "Mercredi",
      "Vendredi",
    ]);
  });
});
