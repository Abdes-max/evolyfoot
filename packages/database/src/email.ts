export function normalizeEducatorEmail(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("L’adresse e-mail de l’éducateur est obligatoire.");
  }

  return normalizedEmail;
}

// Format minimal d’une adresse e-mail : un seul @, une partie locale, un domaine avec un point, sans espace.
// La vraie vérification est l’e-mail de confirmation ; ceci écarte les saisies manifestement fausses.
export function validateEmailFormat(email: string): string {
  if (email.length > 254 || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) {
    throw new Error("Cette adresse e-mail n’est pas valide.");
  }
  return email;
}
