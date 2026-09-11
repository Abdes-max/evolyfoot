// "Samedi 12 septembre" -- formatage français partagé par les formulaires de création qui
// dérivent un `dateLabel` lisible à partir d'un vrai `<input type="date">` (match-list-view.tsx,
// competitions-panel.tsx). Même format que trainingSessionDateLabel côté base
// (player-dashboard-service.ts), dupliqué ici plutôt que partagé entre client et serveur.
export function frenchDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    .format(date)
    .replace(/^\p{L}/u, (letter) => letter.toUpperCase());
}

// `<input type="date">` renvoie "YYYY-MM-DD" (heure locale implicite = minuit) -- converti en
// Date pour l'envoi à l'API (voir date sur MatchSummary/TournamentSummary/PlateauSummary) sans
// glisser d'un jour selon le fuseau (`new Date("YYYY-MM-DD")` parse en UTC minuit, correct ici
// puisqu'on ne garde que le jour calendaire, jamais une heure).
export function parseDateInputValue(value: string): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "YYYY-MM-DDTHH:mm" (valeur brute d'un <input type="datetime-local">) -- interprétée en heure
// locale du navigateur par `new Date()` faute de fuseau explicite dans la chaîne, ce qui est
// justement ce qu'on veut ici (un coup d'envoi se pense toujours dans le fuseau du club, jamais
// en UTC) -- même principe que dans saved-session-view.tsx pour meetingAt.
export function parseDatetimeInputValue(value: string): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDatetimeInputValue(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Ordre chronologique (le plus proche d'abord) partout où une liste doit toujours l'être --
// séances, matchs, tournois/plateaux, observations (voir les pages listes correspondantes). Les
// éléments sans vraie date (fiche créée avant l'introduction du champ `date`, voir le commentaire
// dans schema.prisma) vont à la fin, dans leur ordre d'origine -- ni perdus, ni triés au hasard.
export function sortChronologically<T>(items: readonly T[], getDate: (item: T) => Date | null): T[] {
  const dated = items.filter((item) => getDate(item) !== null);
  const undated = items.filter((item) => getDate(item) === null);
  dated.sort((a, b) => getDate(a)!.getTime() - getDate(b)!.getTime());
  return [...dated, ...undated];
}

// Lundi 00h00 de la semaine de `date`, convention française (contrairement à Date.getDay() qui
// place dimanche en 0).
export function startOfWeek(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  start.setHours(0, 0, 0, 0);
  return start;
}

// "Cette semaine" / "Semaine prochaine" / "Semaine dernière" pour les trois semaines autour
// d'aujourd'hui, sinon la plage de dates ("21-27 septembre", ou "28 sept. - 4 oct." si la semaine
// chevauche deux mois) -- titre affiché au-dessus de chaque groupe d'une liste triée
// chronologiquement (voir sortChronologically, calendar-view.tsx).
export function weekGroupLabel(date: Date, today: Date = new Date()): string {
  const weekStart = startOfWeek(date);
  const diffWeeks = Math.round((weekStart.getTime() - startOfWeek(today).getTime()) / (7 * 24 * 60 * 60 * 1000));
  if (diffWeeks === 0) {
    return "Cette semaine";
  }
  if (diffWeeks === 1) {
    return "Semaine prochaine";
  }
  if (diffWeeks === -1) {
    return "Semaine dernière";
  }
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const startMonth = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(weekStart);
  const endMonth = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(weekEnd);
  if (startMonth === endMonth) {
    return `${weekStart.getDate()}-${weekEnd.getDate()} ${endMonth}`;
  }
  const startShortMonth = new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(weekStart);
  return `${weekStart.getDate()} ${startShortMonth} - ${weekEnd.getDate()} ${endMonth}`;
}

// Clé stable pour regrouper (le lundi de la semaine, en ISO) -- deux dates de la même semaine
// doivent tomber dans le même groupe même si `weekGroupLabel` ci-dessus produit le même texte
// pour des semaines différentes (ex. deux "21-27 septembre" d'années différentes, cas limite mais
// à éviter).
export function weekGroupKey(date: Date): string {
  return startOfWeek(date).toISOString();
}

// Ancre chaque semaine du cycle de progression (S1-S4) sur une vraie semaine calendaire : la
// semaine "active" du cycle (voir currentCycleWeek dans session/cycle.ts) correspond toujours à la
// semaine réelle en cours, les autres semaines du cycle se décalent d'autant. Pas de date de début
// de cycle stockée en base -- ce repère glissant reste correct même si le coach prend du retard ou
// de l'avance sur son cycle.
export function cycleWeekStartDate(weekNumber: number, activeWeek: number, today: Date = new Date()): Date {
  const start = startOfWeek(today);
  start.setDate(start.getDate() + (weekNumber - activeWeek) * 7);
  return start;
}

// "Cette semaine" / "Semaine prochaine" / "21-27 septembre"... pour une semaine du cycle de
// progression (/plan, /seances), même formatage que le bloc convocations.
export function cycleWeekDateRangeLabel(weekNumber: number, activeWeek: number, today: Date = new Date()): string {
  return weekGroupLabel(cycleWeekStartDate(weekNumber, activeWeek, today), today);
}
