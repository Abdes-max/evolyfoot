import { playerEvaluationAspects, type PlayerEvaluationAspect, type PlayerEvaluationScores } from "./player-evaluation";

// Profil sportif d'un joueur, renseigné par l'éducateur sur la fiche joueur.
export const playerPositions = ["Gardien", "Défenseur", "Milieu", "Attaquant"] as const;
export type PlayerPosition = (typeof playerPositions)[number];

export const playerFeet = ["Droit", "Gauche", "Les deux"] as const;
export type PlayerFoot = (typeof playerFeet)[number];

export const playerPositionCodes: Readonly<Record<PlayerPosition, string>> = {
  Gardien: "GB",
  Défenseur: "DEF",
  Milieu: "MIL",
  Attaquant: "ATT",
};

export const playerAspectCodes: Readonly<Record<PlayerEvaluationAspect, string>> = {
  technique: "TEC",
  passe: "PAS",
  vitesse: "VIT",
  physique: "PHY",
  tactique: "TAC",
  mental: "MEN",
  tir: "TIR",
};

// Note de la carte joueur : la moyenne de l'évaluation, sur la même échelle que ses aspects.
export function playerOverallScore(scores: PlayerEvaluationScores): number {
  const total = playerEvaluationAspects.reduce((sum, aspect) => sum + scores[aspect], 0);
  return Math.round((total / playerEvaluationAspects.length) * 10) / 10;
}

export function isValidJerseyNumber(value: string): boolean {
  return /^\d{1,2}$/.test(value);
}
