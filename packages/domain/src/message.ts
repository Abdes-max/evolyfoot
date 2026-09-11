// Message échangé dans le fil de discussion coach <-> joueur/tuteur -- un seul fil par joueur
// (pas de multi-conversation ni de groupe : l'éducateur discute avec un joueur/tuteur à la fois,
// même principe "un joueur = une fiche" que le reste de l'appli, voir PlayerEvaluation).
export type MessageAuthorRole = "coach" | "player";

export interface Message {
  readonly id: string;
  readonly authorRole: MessageAuthorRole;
  readonly authorName: string;
  readonly text: string;
  readonly createdAt: Date;
}

export const messageMaxLength = 1000;

// `null` si valide, sinon un message d'erreur -- même convention que validatePlayerEvaluationScores.
export function validateMessageText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return "Le message ne peut pas être vide.";
  }
  if (trimmed.length > messageMaxLength) {
    return `Le message ne peut pas dépasser ${messageMaxLength} caractères.`;
  }
  return null;
}
