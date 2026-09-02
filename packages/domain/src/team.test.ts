import { describe, expect, it } from "vitest";
import { createTeamProfile, validateTeamProfile } from "./team";
const validTeam = { name: "FC Horizon", ageGroup: "U12" as const, gameFormat: 8 as const, playerCount: 14, sessionsPerWeek: 2, trainingDays: ["Mardi", "Jeudi"] as const };
describe("team profile", () => {
  it("normalise une équipe valide", () => expect(createTeamProfile({ ...validTeam, name: "  FC Horizon  ", trainingDays: [...validTeam.trainingDays] })).toEqual(validTeam));
  it("signale les incohérences", () => { const errors = validateTeamProfile({ ...validTeam, playerCount: 4, trainingDays: ["Mardi"] }); expect(errors.playerCount).toMatch(/6 et 30/); expect(errors.trainingDays).toMatch(/chaque séance/); });
  it("signale un format de jeu invalide", () => { const errors = validateTeamProfile({ ...validTeam, gameFormat: 3 as unknown as (typeof validTeam)["gameFormat"], trainingDays: [...validTeam.trainingDays] }); expect(errors.gameFormat).toMatch(/foot à 4 au foot à 11/); });
});
