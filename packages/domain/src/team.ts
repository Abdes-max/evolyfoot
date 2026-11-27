import type { AgeGroup } from "./index";
export const ageGroups: readonly AgeGroup[] = ["U10", "U11", "U12", "U13"];
export type TrainingDay = "Lundi" | "Mardi" | "Mercredi" | "Jeudi" | "Vendredi";
// Ordre canonique de la semaine (lundi en premier) -- l'ordre dans lequel les jours ont été
// cliqués à la création/modification de l'équipe n'est pas garanti être celui-là (ex. "Mercredi,
// Vendredi, Mardi"), alors que tout ce qui affiche ou numérote ces jours (page Séances,
// calendrier hebdomadaire, génération des séances par créneau) suppose un ordre chronologique.
// Voir sortTrainingDays, appliqué à l'écriture (createTeamProfile) et à la lecture
// (toPersistedTeamProfile côté base) pour couvrir aussi les équipes déjà enregistrées.
const trainingDayOrder: readonly TrainingDay[] = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

export function sortTrainingDays(days: readonly TrainingDay[]): TrainingDay[] {
  return [...days].sort((a, b) => trainingDayOrder.indexOf(a) - trainingDayOrder.indexOf(b));
}
export type GameFormat = 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export const gameFormats: readonly GameFormat[] = [4, 5, 6, 7, 8, 9, 10, 11];
export interface TeamProfile {
  name: string;
  ageGroup: AgeGroup;
  gameFormat: GameFormat;
  playerCount: number;
  sessionsPerWeek: number;
  trainingDays: TrainingDay[];
  // Logo de l'équipe (data URL d'une image réduite) ; absent tant que le coach n'en a pas choisi. Il ne se modifie
  // que par saveLogo : l'enregistrement du profil ne le touche jamais.
  logo?: string | null;
  // URL d'un flux de calendrier externe (.ics) auquel l'équipe est abonnée ; même principe que
  // `logo` -- ne se modifie que par saveCalendarFeedUrl, jamais par l'enregistrement du profil.
  calendarFeedUrl?: string | null;
}
export type TeamProfileErrors = Partial<Record<keyof TeamProfile, string>>;
export function validateTeamProfile(profile: TeamProfile): TeamProfileErrors {
  const errors: TeamProfileErrors = {};
  if (profile.name.trim().length < 2) errors.name = "Indique un nom d’équipe.";
  if (!ageGroups.includes(profile.ageGroup)) errors.ageGroup = "Choisis une catégorie U10 à U13.";
  if (!gameFormats.includes(profile.gameFormat)) errors.gameFormat = "Choisis un format de jeu, du foot à 4 au foot à 11.";
  if (profile.playerCount < 6 || profile.playerCount > 30) errors.playerCount = "L’effectif doit contenir entre 6 et 30 joueurs.";
  if (profile.sessionsPerWeek < 1 || profile.sessionsPerWeek > 4) errors.sessionsPerWeek = "Choisis entre 1 et 4 séances par semaine.";
  if (profile.trainingDays.length !== profile.sessionsPerWeek) errors.trainingDays = "Choisis un jour pour chaque séance hebdomadaire.";
  if (new Set(profile.trainingDays).size !== profile.trainingDays.length) errors.trainingDays = "Chaque séance doit avoir un jour différent.";
  return errors;
}
export function createTeamProfile(profile: TeamProfile): TeamProfile {
  if (Object.keys(validateTeamProfile(profile)).length) throw new Error("Le profil d’équipe est incomplet.");
  return { ...profile, name: profile.name.trim(), trainingDays: sortTrainingDays(profile.trainingDays) };
}

export const teamLogoMaxLength = 400_000;

// Problème du logo proposé, `null` s'il est valide : une petite image en data URL (PNG, JPEG ou WebP).
export function validateTeamLogo(logo: string): string | null {
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(logo)) return "Le logo doit être une image PNG, JPEG ou WebP.";
  if (logo.length > teamLogoMaxLength) return "Le logo est trop lourd : choisis une image plus petite.";
  return null;
}

export const calendarFeedUrlMaxLength = 2000;

// Les abonnements calendrier (iOS, Google, Outlook...) utilisent souvent le schéma `webcal(s):`,
// qui désigne le même flux qu'un simple `http(s):`. On le normalise avant validation/stockage pour
// que le reste du pipeline (fetch, garde anti-SSRF) n'ait à connaître que http(s).
export function normalizeCalendarFeedUrl(url: string): string {
  if (url.startsWith("webcal://")) return `http://${url.slice("webcal://".length)}`;
  if (url.startsWith("webcals://")) return `https://${url.slice("webcals://".length)}`;
  return url;
}

// Problème de l'URL de flux de calendrier proposée, `null` si elle est valide : une URL http(s),
// comme on en reçoit d'un service de ligue (ex. export .ics de la FFF). La résolution réseau et
// la garde anti-SSRF (IP privée/locale) se font côté serveur au moment du fetch, pas ici.
export function validateCalendarFeedUrl(url: string): string | null {
  if (url.length > calendarFeedUrlMaxLength) return "Ce lien est trop long.";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Indique un lien valide.";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "Le lien doit commencer par http://, https:// ou webcal(s)://.";
  return null;
}
