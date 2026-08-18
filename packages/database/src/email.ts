export function normalizeEducatorEmail(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("L’adresse e-mail de l’éducateur est obligatoire.");
  }

  return normalizedEmail;
}
