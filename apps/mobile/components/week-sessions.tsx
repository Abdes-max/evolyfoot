import { colors, spacing } from "@evolyfoot/design-tokens";
import {
  concernedPlayers,
  convocationSendDate,
  sessionsInScope,
  summarizeTrainingResponses,
  themeColors,
  type AttendanceEntry,
  type DevelopmentTheme,
  type SessionScope,
  type TrainingConvocationSettings,
} from "@evolyfoot/domain";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { CancelEventPanel } from "./cancel-event-panel";

interface WeekSession {
  id: string;
  title: string;
  theme?: string;
  meetingAt: string | null;
  location?: string | null;
  cycleNumber?: number;
  weekNumber: number;
  slot: number;
  convokedAt?: string | null;
  attendance?: AttendanceEntry[];
  // Annulée par le coach (ISO) et la raison communiquée aux joueurs.
  cancelledAt?: string | null;
  cancellationNote?: string | null;
}

function dayLabel(date: Date): string {
  const label = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// Où en est la convocation : envoyée (avec les réponses), ou quand elle partira.
function convocationLine(session: WeekSession, settings: TrainingConvocationSettings | null): string {
  if (session.cancelledAt) return `Séance annulée${session.cancellationNote ? ` : ${session.cancellationNote}` : ""}`;
  if (session.convokedAt) {
    return `Convocation envoyée le ${new Date(session.convokedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
  }
  const leadDays = settings?.leadDays ?? null;
  if (leadDays === null) return "Convocation pas encore envoyée (envoi manuel)";
  const sendDate = session.meetingAt ? convocationSendDate(new Date(session.meetingAt), leadDays) : null;
  if (!sendDate) return "Convocation envoyée automatiquement dans les prochaines minutes";
  return `Convocation prévue le ${sendDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à ${sendDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

// Vue par semaine de l'onglet Séances : les séances datées à venir (les plus proches d'abord) ou passées (les plus récentes d'abord),
// jour par jour, avec l'état de leur convocation et les réponses (présents, absents, sans réponse).
export function WeekSessions({ scope }: { scope: SessionScope }) {
  const { apiRequest, roster } = useAuth();
  const [sessions, setSessions] = useState<WeekSession[]>([]);
  const [settings, setSettings] = useState<TrainingConvocationSettings | null>(null);
  const [now] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const [sessionsResponse, settingsResponse] = await Promise.all([apiRequest("/api/sessions?scope=season"), apiRequest("/api/team/convocations")]);
        const sessionsBody = sessionsResponse?.ok ? await sessionsResponse.json().catch(() => null) : null;
        const settingsBody = settingsResponse?.ok ? await settingsResponse.json().catch(() => null) : null;
        if (cancelled) return;
        setSessions(sessionsBody?.sessions ?? []);
        setSettings(settingsBody?.settings ?? null);
      })();
      return () => {
        cancelled = true;
      };
    }, [apiRequest]),
  );

  const trainingRoster = concernedPlayers(roster, settings?.playerIds);

  function open(session: WeekSession) {
    // Séance du cycle en cours : l'écran de préparation ; sinon (saison guidée, ancien cycle) le mode terrain.
    if (session.cycleNumber === 0) {
      router.push(`/terrain/${session.id}`);
    } else {
      router.push(`/session?week=${session.weekNumber}&slot=${session.slot}`);
    }
  }

  // Séances du filtre regroupées par jour, dans l'ordre du filtre.
  const dayGroups: { day: Date; sessions: WeekSession[] }[] = [];
  for (const session of sessionsInScope(sessions, scope, now.getTime())) {
    const day = new Date(session.meetingAt!);
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.day.toDateString() === day.toDateString()) last.sessions.push(session);
    else dayGroups.push({ day, sessions: [session] });
  }

  return (
    <View>
      {dayGroups.length === 0 ? <Text style={styles.empty}>{scope === "past" ? "Aucune séance passée." : "Aucune séance à venir."}</Text> : null}
      {dayGroups.map((entry) => (
        <View key={entry.day.toISOString()} style={styles.day}>
          <Text style={styles.dayLabel}>{dayLabel(entry.day)}</Text>
          {entry.sessions.map((session) => {
            const responses = summarizeTrainingResponses(trainingRoster, session.attendance);
            return (
              <TouchableOpacity
                accessibilityRole="button"
                key={session.id}
                onPress={() => open(session)}
                style={[styles.card, { borderLeftWidth: 4, borderLeftColor: themeColors[session.theme as DevelopmentTheme] ?? colors.line }]}
              >
                <View style={styles.cardHead}>
                  <Text numberOfLines={1} style={styles.cardTitle}>
                    {session.title}
                  </Text>
                  <Text style={styles.time}>{timeLabel(session.meetingAt!)}</Text>
                </View>
                {session.location ? (
                  <Text numberOfLines={1} style={styles.muted}>
                    {session.location}
                  </Text>
                ) : null}
                <Text style={[styles.convocation, session.cancelledAt ? styles.cancelled : session.convokedAt ? styles.sent : styles.pending]}>
                  {convocationLine(session, settings)}
                </Text>
                {session.convokedAt ? (
                  <View style={styles.counts}>
                    <Text style={[styles.count, { color: "#3ddc84" }]}>{responses.present.length} présents</Text>
                    <Text style={[styles.count, { color: "#ff6b6b" }]}>{responses.absent.length} absents</Text>
                    <Text style={[styles.count, { color: "#ffb073" }]}>{responses.pending.length} sans réponse</Text>
                  </View>
                ) : null}
                <CancelEventPanel
                  cancellationNote={session.cancellationNote}
                  cancelledAt={session.cancelledAt}
                  noun="la séance"
                  onChange={(state) => setSessions((current) => current.map((item) => (item.id === session.id ? { ...item, ...state } : item)))}
                  url={`/api/sessions/${encodeURIComponent(session.id)}/cancel`}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.muted, fontSize: 13, textAlign: "center", marginVertical: spacing.lg },
  day: { marginBottom: spacing.md },
  dayLabel: { color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 },
  card: { gap: 4, padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, marginBottom: 8 },
  cardHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
  cardTitle: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "800" },
  time: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  muted: { color: colors.muted, fontSize: 12 },
  convocation: { fontSize: 12, fontWeight: "800", marginTop: 4 },
  sent: { color: colors.lime },
  pending: { color: colors.muted },
  cancelled: { color: colors.danger },
  counts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: 2 },
  count: { fontSize: 12, fontWeight: "800" },
});
