import { colors, spacing } from "@evolyfoot/design-tokens";
import { concernedPlayers, convocationSendDate, summarizeTrainingResponses, type AttendanceEntry, type TrainingConvocationSettings } from "@evolyfoot/domain";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";

interface WeekSession {
  id: string;
  title: string;
  meetingAt: string | null;
  location?: string | null;
  cycleNumber?: number;
  weekNumber: number;
  slot: number;
  convokedAt?: string | null;
  attendance?: AttendanceEntry[];
}

const dayMs = 86_400_000;

function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function weekTitle(monday: Date, offset: number): string {
  if (offset === 0) return "Cette semaine";
  if (offset === 1) return "Semaine prochaine";
  if (offset === -1) return "Semaine dernière";
  const sunday = new Date(monday.getTime() + 6 * dayMs);
  return `${monday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
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
  if (session.convokedAt) {
    return `Convocation envoyée le ${new Date(session.convokedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
  }
  const leadDays = settings?.leadDays ?? null;
  if (leadDays === null) return "Convocation pas encore envoyée (envoi manuel)";
  const sendDate = session.meetingAt ? convocationSendDate(new Date(session.meetingAt), leadDays) : null;
  if (!sendDate) return "Convocation envoyée automatiquement dans les prochaines minutes";
  return `Convocation prévue le ${sendDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à ${sendDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

// Vue par semaine de l'onglet Séances : les séances datées de la semaine, jour par jour, avec l'état
// de leur convocation et les réponses (présents, absents, sans réponse).
export function WeekSessions() {
  const { apiRequest, roster } = useAuth();
  const [offset, setOffset] = useState(0);
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

  const monday = new Date(mondayOf(now).getTime() + offset * 7 * dayMs);
  const days = Array.from({ length: 7 }, (_, index) => new Date(monday.getTime() + index * dayMs));
  const trainingRoster = concernedPlayers(roster, settings?.playerIds);

  function open(session: WeekSession) {
    // Séance du cycle en cours : l'écran de préparation ; sinon (saison guidée, ancien cycle) le mode terrain.
    if (session.cycleNumber === 0) {
      router.push(`/terrain/${session.id}`);
    } else {
      router.push(`/session?week=${session.weekNumber}&slot=${session.slot}`);
    }
  }

  const weekSessions = days.map((day) => ({
    day,
    sessions: sessions
      .filter((session) => session.meetingAt && new Date(session.meetingAt).toDateString() === day.toDateString())
      .sort((a, b) => new Date(a.meetingAt!).getTime() - new Date(b.meetingAt!).getTime()),
  }));
  const empty = weekSessions.every((entry) => entry.sessions.length === 0);

  return (
    <View>
      <View style={styles.nav}>
        <TouchableOpacity
          accessibilityLabel="Semaine précédente"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setOffset(offset - 1)}
          style={styles.navButton}
        >
          <Text style={styles.navText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={offset === 0} onPress={() => setOffset(0)}>
          <Text style={styles.navTitle}>{weekTitle(monday, offset)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Semaine suivante"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setOffset(offset + 1)}
          style={styles.navButton}
        >
          <Text style={styles.navText}>›</Text>
        </TouchableOpacity>
      </View>

      {empty ? <Text style={styles.empty}>Aucune séance datée cette semaine.</Text> : null}
      {weekSessions
        .filter((entry) => entry.sessions.length > 0)
        .map((entry) => (
          <View key={entry.day.toISOString()} style={styles.day}>
            <Text style={styles.dayLabel}>{dayLabel(entry.day)}</Text>
            {entry.sessions.map((session) => {
              const responses = summarizeTrainingResponses(trainingRoster, session.attendance);
              return (
                <TouchableOpacity accessibilityRole="button" key={session.id} onPress={() => open(session)} style={styles.card}>
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
                  <Text style={[styles.convocation, session.convokedAt ? styles.sent : styles.pending]}>{convocationLine(session, settings)}</Text>
                  {session.convokedAt ? (
                    <View style={styles.counts}>
                      <Text style={[styles.count, { color: "#3ddc84" }]}>{responses.present.length} présents</Text>
                      <Text style={[styles.count, { color: "#ff6b6b" }]}>{responses.absent.length} absents</Text>
                      <Text style={[styles.count, { color: "#ffb073" }]}>{responses.pending.length} sans réponse</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  navButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: colors.line },
  navText: { color: colors.ink, fontSize: 22, fontWeight: "800", lineHeight: 24 },
  navTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
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
  counts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: 2 },
  count: { fontSize: 12, fontWeight: "800" },
});
