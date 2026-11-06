// Joueurs concernés par un événement (match, tournoi, plateau) ou par les entraînements : cochés
// par l'éducateur parmi l'effectif. `null` = tout l'effectif, valeur des événements créés avant
// ce choix et de l'équipe qui n'a rien restreint. Seuls les joueurs concernés voient l'événement,
// reçoivent la convocation et peuvent répondre.
export type PlayerSelection = readonly string[] | null;

export function isConcerned(selection: PlayerSelection | undefined, playerId: string): boolean {
  return selection === null || selection === undefined || selection.includes(playerId);
}

export function concernedPlayers<Player extends { readonly id: string }>(roster: readonly Player[], selection: PlayerSelection | undefined): Player[] {
  return roster.filter((player) => isConcerned(selection, player.id));
}

// Valeur reçue d'un formulaire : `undefined` = champ absent (inchangé), `null` = tout l'effectif,
// sinon une liste d'ids de l'effectif sans doublon. Tout cocher revient à `null`, pour qu'un joueur
// ajouté plus tard à l'effectif soit concerné lui aussi. Lève une erreur pour une liste vide ou un
// id hors effectif.
export function parsePlayerSelection(value: unknown, rosterIds: readonly string[]): PlayerSelection | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) {
    throw new Error("Liste de joueurs invalide.");
  }
  const ids = [...new Set(value as string[])];
  if (ids.length === 0) {
    throw new Error("Coche au moins un joueur.");
  }
  if (ids.some((id) => !rosterIds.includes(id))) {
    throw new Error("Un des joueurs cochés ne fait pas partie de l’effectif.");
  }
  return rosterIds.every((id) => ids.includes(id)) ? null : ids;
}
