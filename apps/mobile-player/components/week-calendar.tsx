import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { Dashboard } from "../lib/dashboard";
import { themedStyles } from "../lib/themed-styles";

const weekDays: readonly { short: string; full: string }[] = [
  { short: "LUN.", full: "Lundi" },
  { short: "MAR.", full: "Mardi" },
  { short: "MER.", full: "Mercredi" },
  { short: "JEU.", full: "Jeudi" },
  { short: "VEN.", full: "Vendredi" },
  { short: "SAM.", full: "Samedi" },
  { short: "DIM.", full: "Dimanche" },
];

const matchColor = "#3ddc84";

function TargetIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg fill="none" height={size} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <Circle cx={12} cy={12} r={8} />
      <Circle cx={12} cy={12} r={4.5} />
      <Circle cx={12} cy={12} fill={color} r={1} stroke="none" />
    </Svg>
  );
}

function BallIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg fill="none" height={size} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 8.2 15.5 10.7 14.2 14.8h-4.4L8.5 10.7Z" />
      <Path d="M12 8.2V4.3M15.5 10.7 19 8.6M14.2 14.8 15.6 19M9.8 14.8 8.4 19M8.5 10.7 5 8.6" />
    </Svg>
  );
}

function Badge({ kind, size = 26 }: { kind: "training" | "match"; size?: number }) {
  const training = kind === "training";
  return (
    <View
      accessibilityLabel={training ? "Séance d’entraînement" : "Match ou compétition"}
      style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: training ? colors.primary : matchColor }]}
    >
      {training ? <TargetIcon color={colors.primaryInk} size={size * 0.55} /> : <BallIcon color="#06210f" size={size * 0.55} />}
    </View>
  );
}

// Lundi de la semaine de `time`, à minuit (heure locale).
function mondayOf(time: number): Date {
  const monday = new Date(time);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

// « Calendrier de la semaine » : mêmes 7 colonnes que l'onglet Calendrier du web, une pastille pour
// l'entraînement (jour d'entraînement de l'équipe ou séance datée ce jour-là) et une pour un match ou
// une compétition, d'après leurs vraies dates.
export function WeekCalendar({ dashboard, now }: { dashboard: Dashboard; now: number }) {
  const monday = mondayOf(now);
  const today = new Date(now).toDateString();
  const trainingDays = dashboard.team?.trainingDays ?? [];
  const dated = (iso: string | null): string | null => (iso ? new Date(iso).toDateString() : null);
  const sessionDays = new Set(dashboard.trainingSessions.map((session) => dated(session.date)));
  const matchDays = new Set(
    [...dashboard.upcomingMatches, ...(dashboard.pastMatches ?? []), ...(dashboard.competitions ?? [])].map((event) => dated(event.date)),
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Calendrier de la semaine</Text>
      <View style={styles.grid}>
        {weekDays.map((day, index) => {
          const date = new Date(monday);
          date.setDate(monday.getDate() + index);
          const key = date.toDateString();
          const isToday = key === today;
          const training = trainingDays.includes(day.full) || sessionDays.has(key);
          const match = matchDays.has(key);
          return (
            <View key={day.full} style={styles.day}>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{day.short}</Text>
              <View style={[styles.cell, isToday && styles.cellToday]}>
                {training ? <Badge kind="training" size={20} /> : null}
                {match ? <Badge kind="match" size={20} /> : null}
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <Badge kind="training" size={20} />
          <Text style={styles.legendText}>Séance d’entraînement</Text>
        </View>
        <View style={styles.legendItem}>
          <Badge kind="match" size={20} />
          <Text style={styles.legendText}>Match / compétition</Text>
        </View>
      </View>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    card: {
      gap: 11,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.primaryDark,
      backgroundColor: colors.surface,
    },
    title: { color: colors.ink, fontSize: 12, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" },
    grid: { flexDirection: "row", gap: 6 },
    day: { flex: 1, alignItems: "center", gap: 7, minWidth: 0 },
    dayLabel: { color: "#86e8ff", fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
    dayLabelToday: { color: colors.primaryInk, backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, overflow: "hidden" },
    cell: {
      width: "100%",
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: "transparent",
      backgroundColor: colors.paper,
    },
    cellToday: { borderColor: colors.primary },
    badge: { alignItems: "center", justifyContent: "center" },
    legend: { gap: 5 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
    legendText: { color: colors.muted, fontSize: 10.5 },
  }),
);
