// Retour affiché à l'éducateur après l'envoi d'une convocation (web et EvolyFoot Coach).
export function convocationFeedback(sentCount: number, emailCount = 0): string {
  const sent = `Convocation envoyée à ${sentCount} joueur${sentCount > 1 ? "s" : ""}.`;
  if (emailCount <= 0) {
    return sent;
  }
  return `${sent} Rappel envoyé par e-mail à ${emailCount} adresse${emailCount > 1 ? "s" : ""}.`;
}
