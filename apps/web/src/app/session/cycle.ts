// Le cycle du plan de progression compte 4 semaines (voir buildDevelopmentPlan côté domaine et
// trainingCycleWeekCount côté base). Redéfini ici comme simple constante pour rester utilisable
// dans les composants client sans tirer le paquet base (Prisma) dans le bundle navigateur.
export const trainingCycleWeekCount = 4;

export function cycleWeekLabel(weekNumber: number): string {
  return `Semaine ${weekNumber} sur ${trainingCycleWeekCount}`;
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
