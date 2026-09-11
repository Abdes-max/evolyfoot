// Heure du coup d'envoi et rendez-vous d'un match -- partagés entre PlayerDashboardService,
// ConvocationService et le serveur web (voir match.ts), tous trois ayant besoin de la même
// dérivation à partir de MatchRecord.date/meetingOffsetMinutes (voir le commentaire dans
// schema.prisma).

// Fuseau du club plutôt que celui (souvent UTC) du serveur qui exécute ce code : un horodatage
// formaté sans fuseau explicite prend sinon le fuseau système, correct par hasard en local mais
// faux en production -- même correctif à appliquer partout où une heure de match/séance
// s'affiche (voir le même `timeZone` dans player-dashboard-service.ts).
const clubTimeZone = "Europe/Paris";

// "14:30" -- heure du coup d'envoi, ou `null` si le match n'a pas encore de vraie date (créé
// avant l'introduction de ce champ, ou date non renseignée).
export function matchKickoffTime(date: Date | null): string | null {
  return date ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: clubTimeZone }).format(date) : null;
}

// Rendez-vous, calculé à `date - meetingOffsetMinutes` quand les deux sont renseignés -- sinon
// repli sur `legacyMeetingTime` (texte libre saisi avant l'introduction de ce calcul automatique,
// ou pour un rendez-vous qui ne suit pas cette règle).
export function matchMeetingTime(date: Date | null, meetingOffsetMinutes: number | null, legacyMeetingTime: string | null): string | null {
  if (date && meetingOffsetMinutes !== null) {
    const meetingAt = new Date(date.getTime() - meetingOffsetMinutes * 60_000);
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: clubTimeZone }).format(meetingAt);
  }
  return legacyMeetingTime;
}
