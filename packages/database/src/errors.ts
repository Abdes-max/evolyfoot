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

export class DuplicateEducatorEmailError extends Error {
  constructor() {
    super("Cette adresse e-mail est déjà utilisée.");
    this.name = "DuplicateEducatorEmailError";
  }
}
