// Les erreurs de base de données (Prisma) portent la requête, le code source et le chemin disque du
// serveur dans leur message : elles ne doivent jamais sortir telles quelles dans une réponse.
// Les handlers renvoient le message des erreurs métier (Error générique) en 400 ; cette fonction
// passe avant pour les écarter.
function isDatabaseError(error: unknown): error is Error & { code?: string } {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name.startsWith("PrismaClient") || /^\s*Invalid `[\w.]+\(\)` invocation/.test(error.message);
}

// Renvoie une réponse propre pour une erreur de base de données, ou `null` pour toute autre erreur.
export function databaseErrorResponse(error: unknown, log: (error: unknown) => void): Response | null {
  if (!isDatabaseError(error)) {
    return null;
  }
  // P2023 / P2007 : identifiant mal formé (pas un UUID). Rien ne peut correspondre : introuvable.
  if (error.code === "P2023" || (error.code === "P2007" && /type uuid/.test(error.message))) {
    return Response.json({ error: "Élément introuvable." }, { status: 404 });
  }
  // Valeur d'un mauvais type ou d'un mauvais format (date invalide...).
  if (error.name === "PrismaClientValidationError") {
    return Response.json({ error: "Une valeur envoyée est invalide." }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}
