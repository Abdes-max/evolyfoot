export class EducatorNotFoundError extends Error {
  constructor() {
    super("Éducateur introuvable.");
    this.name = "EducatorNotFoundError";
  }
}

export class TeamNotFoundError extends Error {
  constructor() {
    super("Profil d’équipe introuvable.");
    this.name = "TeamNotFoundError";
  }
}

export class DiagnosticNotFoundError extends Error {
  constructor() {
    super("Diagnostic introuvable.");
    this.name = "DiagnosticNotFoundError";
  }
}

export class PlayerNotFoundError extends Error {
  constructor() {
    super("Joueur introuvable.");
    this.name = "PlayerNotFoundError";
  }
}

export class PlayerEvaluationNotFoundError extends Error {
  constructor() {
    super("Évaluation introuvable.");
    this.name = "PlayerEvaluationNotFoundError";
  }
}

export class MatchNotFoundError extends Error {
  constructor() {
    super("Match introuvable.");
    this.name = "MatchNotFoundError";
  }
}

export class TrainingSessionNotFoundError extends Error {
  constructor() {
    super("Séance introuvable.");
    this.name = "TrainingSessionNotFoundError";
  }
}

export class TournamentNotFoundError extends Error {
  constructor() {
    super("Tournoi introuvable.");
    this.name = "TournamentNotFoundError";
  }
}

export class PlateauNotFoundError extends Error {
  constructor() {
    super("Plateau introuvable.");
    this.name = "PlateauNotFoundError";
  }
}

export class ObservationNotFoundError extends Error {
  constructor() {
    super("Observation introuvable.");
    this.name = "ObservationNotFoundError";
  }
}

export class DuplicateEducatorEmailError extends Error {
  constructor() {
    super("Cette adresse e-mail est déjà utilisée.");
    this.name = "DuplicateEducatorEmailError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Adresse e-mail ou mot de passe incorrect.");
    this.name = "InvalidCredentialsError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
