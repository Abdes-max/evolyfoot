// Un plateau (rassemblement U6–U11 : plusieurs équipes, matchs courts en rotation) est une fiche
// aussi simple qu'un tournoi -- nom, date, bilan en quelques mots -- comptée à part des matchs et
// des tournois dans les statistiques. Même forme que TournamentInput, dupliquée volontairement
// pour que les deux concepts restent indépendants côté domaine.
export interface PlateauInput {
  readonly name: string;
  readonly dateLabel: string;
  readonly result?: string;
}

export interface PlateauErrors {
  name?: string;
  dateLabel?: string;
}

export function validatePlateau(input: PlateauInput): PlateauErrors {
  const errors: PlateauErrors = {};
  if (!input.name.trim()) {
    errors.name = "Indique le nom du plateau.";
  }
  if (!input.dateLabel.trim()) {
    errors.dateLabel = "Indique une date.";
  }
  return errors;
}
