import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { attendanceStatusLabels, attendanceStatuses, type AttendanceStatus } from "@evolyfoot/domain";
import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Screen } from "../components/screen";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { buildAgenda, useDashboard, type AgendaEvent } from "../lib/dashboard";
import { openInMaps } from "../lib/open-in-maps";

const absenceReasons = attendanceStatuses.filter((status) => status !== "present");

export default function CalendarScreen() {
  const { sessionToken } = useAuth();
  const { dashboard, status, reload } = useDashboard();
  const [now] = useState(() => Date.now());
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function respond(event: AgendaEvent, response: AttendanceStatus) {
    setBusyKey(event.key);
    const [path, idField] = event.kind === "match" ? ["/api/joueur/rsvp", "matchId"] : ["/api/joueur/rsvp-seance", "sessionId"];
    const result = await apiFetch(path, {
      method: "POST",
      sessionToken,
      body: JSON.stringify({ [idField]: event.id, status: response }),
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

  const agenda = dashboard ? buildAgenda(dashboard, now) : [];

  return (
    <Screen title="Calendrier">
      {status === "error" && !dashboard ? <Text style={styles.note}>Impossible de charger ton calendrier.</Text> : null}
      {dashboard && agenda.length === 0 ? <Text style={styles.note}>Rien de prévu pour l’instant.</Text> : null}
      {agenda.map((event) => {
        const present = event.myStatus === "present";
        const absent = event.myStatus !== null && !present;
        return (
          <View key={event.key} style={styles.event}>
            <Text style={styles.kind}>{event.kind === "match" ? "MATCH" : "ENTRAÎNEMENT"}</Text>
            <Text style={styles.title}>{event.title}</Text>
            <Text style={styles.meta}>{[event.dateLabel, event.time].filter(Boolean).join(" · ")}</Text>
            {event.location ? (
              <TouchableOpacity accessibilityRole="link" onPress={() => void openInMaps(event.location!)} style={styles.place}>
                <Text style={styles.placeText}>{event.location}</Text>
                <Text style={styles.placeLink}>Y aller (Plans, Google Maps, Waze…) →</Text>
              </TouchableOpacity>
            ) : null}
            {event.canRespond ? (
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
            ) : (
              <Text style={styles.meta}>Pas convoqué pour ce match.</Text>
            )}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  event: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
  },
  kind: { color: colors.lime, fontSize: 11, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 17, fontWeight: "800", marginTop: 3 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  place: { minHeight: 44, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.primaryDark },
  placeText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  placeLink: { color: colors.primary, fontSize: 12, fontWeight: "800", marginTop: 2 },
  choices: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  choice: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line },
  choicePresent: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceAbsent: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  choiceText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  choiceTextActive: { color: colors.primaryInk },
});
