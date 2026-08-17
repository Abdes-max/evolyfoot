import type { AgeGroup } from "./index";
export const ageGroups: readonly AgeGroup[] = ["U10", "U11", "U12", "U13"];
export type TrainingDay = "Lundi" | "Mardi" | "Mercredi" | "Jeudi" | "Vendredi";
export interface TeamProfile { name: string; ageGroup: AgeGroup; playerCount: number; sessionsPerWeek: number; trainingDays: TrainingDay[]; }
export type TeamProfileErrors = Partial<Record<keyof TeamProfile, string>>;
export function validateTeamProfile(profile: TeamProfile): TeamProfileErrors {
  const errors: TeamProfileErrors = {};
  if (profile.name.trim().length < 2) errors.name = "Indique un nom d’équipe.";
  if (!ageGroups.includes(profile.ageGroup)) errors.ageGroup = "Choisis une catégorie U10 à U13.";
  if (profile.playerCount < 6 || profile.playerCount > 30) errors.playerCount = "L’effectif doit contenir entre 6 et 30 joueurs.";
  if (profile.sessionsPerWeek < 1 || profile.sessionsPerWeek > 4) errors.sessionsPerWeek = "Choisis entre 1 et 4 séances par semaine.";
  if (profile.trainingDays.length !== profile.sessionsPerWeek) errors.trainingDays = "Choisis un jour pour chaque séance hebdomadaire.";
  if (new Set(profile.trainingDays).size !== profile.trainingDays.length) errors.trainingDays = "Chaque séance doit avoir un jour différent.";
  return errors;
}
export function createTeamProfile(profile: TeamProfile): TeamProfile {
  if (Object.keys(validateTeamProfile(profile)).length) throw new Error("Le profil d’équipe est incomplet.");
  return { ...profile, name: profile.name.trim(), trainingDays: [...profile.trainingDays] };
}
