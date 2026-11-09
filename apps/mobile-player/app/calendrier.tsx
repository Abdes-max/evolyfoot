import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { attendanceStatusLabels, attendanceStatuses, type AttendanceStatus } from "@evolyfoot/domain";
import { Fragment, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { EventCard } from "../components/event-card";
import { Screen } from "../components/screen";
import { WaitingApproval } from "../components/waiting-approval";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { buildAgenda, useDashboard, type AgendaEvent } from "../lib/dashboard";

const absenceReasons = attendanceStatuses.filter((status) => status !== "present");

function mondayOf(time: number): number {
  const day = new Date(time);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day.getTime();
}

// Titre de la semaine d’un événement : « Cette semaine », « Semaine prochaine », « Semaine
// dernière », sinon « Semaine du 17 novembre ».
function weekLabel(date: string | null, now: number): string {
  if (!date) return "Date à préciser";
  const monday = mondayOf(new Date(date).getTime());
  const weeks = Math.round((monday - mondayOf(now)) / (7 * 24 * 3600 * 1000));
  if (weeks === 0) return "Cette semaine";
  if (weeks === 1) return "Semaine prochaine";
  if (weeks === -1) return "Semaine dernière";
  return `Semaine du ${new Date(monday).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
}

export default function CalendarScreen() {
  const { sessionToken } = useAuth();
  const { dashboard, status, reload } = useDashboard();
  const [now] = useState(() => Date.now());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");

  async function respond(event: AgendaEvent, response: AttendanceStatus) {
    setBusyKey(event.key);
    const [path, body] =
      event.kind === "match"
        ? ["/api/joueur/rsvp", { matchId: event.id }]
        : event.kind === "training"
          ? ["/api/joueur/rsvp-seance", { sessionId: event.id }]
          : ["/api/joueur/rsvp-competition", { kind: event.kind, competitionId: event.id }];
    const result = await apiFetch(path, {
      method: "POST",
      sessionToken,
      body: JSON.stringify({ ...body, status: response }),
    }).catch(() => null);
    setBusyKey(null);
    if (!result?.ok) {
      Alert.alert("La réponse n’a pas été envoyée.", "Vérifie ta connexion et réessaie.");
      return;
    }
    await reload();
  }

  function askAbsenceReason(event: AgendaEvent) {
    Alert.alert("Pourquoi es-tu absent ?", undefined, [
      ...absenceReasons.map((reason) => ({ text: attendanceStatusLabels[reason], onPress: () => respond(event, reason) })),
      { text: "Annuler", style: "cancel" as const },
    ]);
  }

  const agenda = dashboard ? buildAgenda(dashboard, now, scope) : [];

  return (
    <Screen title="Calendrier">
      <View accessibilityRole="tablist" style={styles.filters}>
        {(
          [
            ["upcoming", "À venir"],
            ["past", "Passés"],
          ] as const
        ).map(([value, label]) => (
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === value }}
            key={value}
            onPress={() => setScope(value)}
            style={[styles.filter, scope === value && styles.filterActive]}
          >
            <Text style={[styles.filterText, scope === value && styles.filterTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {status === "error" && !dashboard ? <Text style={styles.note}>Impossible de charger ton calendrier.</Text> : null}
      {status === "waiting" ? <WaitingApproval /> : null}
      {dashboard && agenda.length === 0 ? (
        <Text style={styles.note}>{scope === "past" ? "Aucun événement passé." : "Rien de prévu pour l’instant."}</Text>
      ) : null}
      {agenda.map((event, index) => {
        const present = event.myStatus === "present";
        const absent = event.myStatus !== null && !present;
        const week = weekLabel(event.date, now);
        const newWeek = index === 0 || weekLabel(agenda[index - 1]!.date, now) !== week;
        return (
          <Fragment key={event.key}>
            {newWeek ? <Text style={styles.weekTitle}>{week}</Text> : null}
            <EventCard event={event}>
              {scope === "past" ? (
                event.myStatus ? (
                  <Text style={styles.meta}>Ta réponse : {attendanceStatusLabels[event.myStatus]}</Text>
                ) : null
              ) : event.canRespond ? (
                <View>
                  {event.byDefault && event.myStatus === "present" ? (
                    <Text style={styles.meta}>Tu es compté présent par défaut. Préviens si tu ne peux pas venir.</Text>
                  ) : null}
                  <View style={styles.choices}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{ selected: present }}
                      disabled={busyKey === event.key}
                      onPress={() => respond(event, "present")}
                      style={[styles.choice, present && styles.choicePresent]}
                    >
                      <Text style={[styles.choiceText, present && styles.choiceTextActive]}>Présent</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{ selected: absent }}
                      disabled={busyKey === event.key}
                      onPress={() => askAbsenceReason(event)}
                      style={[styles.choice, absent && styles.choiceAbsent]}
                    >
                      <Text style={styles.choiceText}>{absent ? attendanceStatusLabels[event.myStatus!] : "Absent"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.meta}>
                  {event.kind === "match" ? "Pas convoqué pour ce match." : "Programmé : tu pourras répondre quand la convocation sera envoyée."}
                </Text>
              )}
            </EventCard>
          </Fragment>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  weekTitle: { color: colors.muted, fontSize: 14, fontWeight: "800", marginTop: spacing.sm, marginBottom: spacing.sm },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  choices: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  filters: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  filter: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  filterTextActive: { color: colors.primaryInk },
  choice: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line },
  choicePresent: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceAbsent: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  choiceText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  choiceTextActive: { color: colors.primaryInk },
});
