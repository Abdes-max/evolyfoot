// Nom complet du jour de la semaine courant, dans le même vocabulaire que les grilles de
// calendrier (weekly-calendar.tsx, player-dashboard-view.tsx) : "Lundi".."Dimanche". `Date#getDay`
// renvoie 0 pour dimanche -- décalé ici pour que l'index 0 soit lundi, comme ces grilles.
const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

export function todayWeekDayFull(): string {
  const jsDay = new Date().getDay(); // 0 = dimanche .. 6 = samedi
  return dayNames[(jsDay + 6) % 7]!;
}
