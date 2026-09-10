// Un tournoi est une fiche simple (nom, date, bilan en quelques mots), comptée à part des matchs
// -- contrairement à MatchRecord, pas de composition ni de formation : juste de quoi le
// dénombrer et le retrouver dans les statistiques.
export interface TournamentInput {
  readonly name: string;
  readonly dateLabel: string;
  readonly result?: string;
}

export interface TournamentErrors {
  name?: string;
  dateLabel?: string;
}

export function validateTournament(input: TournamentInput): TournamentErrors {
  const errors: TournamentErrors = {};
  if (!input.name.trim()) {
    errors.name = "Indique le nom du tournoi.";
  }
  if (!input.dateLabel.trim()) {
    errors.dateLabel = "Indique une date.";
  }
  return errors;
}
