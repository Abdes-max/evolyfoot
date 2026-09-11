"use client";

// Calculée côté client à chaque rendu plutôt que mémorisée dans un état posé en useEffect
// (react-hooks/set-state-in-effect l'interdit dans ce projet, voir auth-gate.tsx) : /app est
// prérendue statiquement (aucune donnée de session lue côté serveur, tout passe par AuthGate +
// fetch client), donc figer la date dans un state à l'hydratation reviendrait de toute façon à
// afficher la date du build tant que ce composant n'a pas re-rendu pour une autre raison.
export function TodayDate() {
  const label = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
  return <span className="date">{label}</span>;
}
