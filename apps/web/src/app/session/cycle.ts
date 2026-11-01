// Le cycle du plan de progression compte 4 semaines (voir buildDevelopmentPlan côté domaine et
// trainingCycleWeekCount côté base). Redéfini ici comme simple constante pour rester utilisable
// dans les composants client sans tirer le paquet base (Prisma) dans le bundle navigateur.
export const trainingCycleWeekCount = 4;

export function cycleWeekLabel(weekNumber: number): string {
  return `Semaine ${weekNumber} sur ${trainingCycleWeekCount}`;
}

const weekdayIndexes: Readonly<Record<string, number>> = { Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5 };
const defaultMeetingHour = 18;

// Rendez-vous proposé pour un créneau : le prochain jour d'entraînement, décalé selon l'écart avec
// la semaine en cours, à 18h. Simple valeur de départ, que l'éducateur peut modifier. `null` si
// le créneau n'a pas de jour réel (équipe sans jours d'entraînement renseignés).
export function suggestedMeetingAt(dayLabel: string | undefined, weekNumber: number, activeWeek: number, now: Date): string | null {
  const weekday = dayLabel ? weekdayIndexes[dayLabel] : undefined;
  if (weekday === undefined) {
    return null;
  }
  const daysAhead = (weekday - now.getDay() + 7) % 7 || 7;
  const date = new Date(now);
  date.setDate(now.getDate() + daysAhead + Math.max(weekNumber - activeWeek, 0) * 7);
  date.setHours(defaultMeetingHour, 0, 0, 0);
  return date.toISOString();
}

// « Semaine en cours » du cycle pour le tableau de bord : la première semaine dont toutes les
// séances ne sont pas encore générées (une par jour d'entraînement) ; la dernière si tout est
// généré. Déterministe, sans état supplémentaire à persister.
export function currentCycleWeek(sessions: ReadonlyArray<{ weekNumber: number }>, slotsPerWeek: number): number {
  const target = Math.max(slotsPerWeek, 1);
  for (let week = 1; week <= trainingCycleWeekCount; week += 1) {
    const generated = sessions.filter((session) => session.weekNumber === week).length;
    if (generated < target) {
      return week;
    }
  }
  return trainingCycleWeekCount;
}
