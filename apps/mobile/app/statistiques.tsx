import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { buildTeamStatsReport, pluralize, type AttendanceStats, type TeamStats } from "@evolyfoot/domain";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { sharePdf, statsHtml } from "../lib/pdf-export";

function ActivityBars({ stats }: { stats: TeamStats }) {
  const data = [
    { label: "Séances", value: stats.trainingCount },
    { label: "Matchs", value: stats.matchCount },
    { label: "Tournois", value: stats.tournamentCount },
    { label: "Plateaux", value: stats.plateauCount },
  ];
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <View accessibilityLabel={data.map((item) => `${item.label} : ${item.value}`).join(", ")}>
      {data.map((item) => (
        <View key={item.label} style={styles.barRow}>
          <Text style={styles.barLabel}>{item.label}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(item.value / max) * 100}%` }]} />
          </View>
          <Text style={styles.barValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function Attendance({ title, attendance }: { title: string; attendance: AttendanceStats }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {attendance.total > 0 ? (
        <>
          <Text style={styles.rate}>{attendance.rate}%</Text>
          <View accessibilityLabel={`${attendance.present} présents, ${attendance.absent} absents`} style={styles.split}>
            <View style={[styles.present, { flex: attendance.present }]} />
            <View style={[styles.absent, { flex: attendance.absent }]} />
          </View>
          <Text style={styles.muted}>
            {pluralize(attendance.present, "présent")} · {pluralize(attendance.absent, "absent")}
          </Text>
        </>
      ) : (
        <Text style={styles.muted}>Aucune présence saisie pour l’instant.</Text>
      )}
    </View>
  );
}

export default function StatistiquesScreen() {
  const { getTeamStats, team } = useAuth();
  const [exporting, setExporting] = useState(false);

  async function exportPdf(current: TeamStats) {
    setExporting(true);
    const result = await sharePdf(statsHtml(current, team?.name ?? ""), "Rapport de saison");
    setExporting(false);
    if (!result.ok) {
      Alert.alert(result.error);
    }
  }
  const [stats, setStats] = useState<TeamStats | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getTeamStats().then((result) => {
        if (!cancelled) {
          setStats(result);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [getTeamStats]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.step}>STATISTIQUES</Text>
        <Text style={styles.title}>Les chiffres de ta saison.</Text>
        {stats === undefined && <Text style={styles.muted}>Chargement…</Text>}
        {stats === null && <Text style={styles.error}>Les statistiques n’ont pas pu être chargées.</Text>}
        {stats && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Activité de la saison</Text>
              <ActivityBars stats={stats} />
              <Text style={styles.muted}>
                {pluralize(stats.matchesPlayed, "match joué", "matchs joués")} · {stats.matchesScheduled} à venir
              </Text>
            </View>
            <Attendance attendance={stats.trainingAttendance} title="Présence aux séances" />
            <Attendance attendance={stats.matchAttendance} title="Présence aux matchs" />
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Rapport</Text>
              {buildTeamStatsReport(stats).map((line) => (
                <Text key={line} style={styles.reportLine}>
                  • {line}
                </Text>
              ))}
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={exporting}
              onPress={() => exportPdf(stats)}
              style={[styles.pdf, exporting && styles.disabled]}
            >
              <Text style={styles.pdfText}>{exporting ? "Création du PDF…" : "Exporter le rapport en PDF"}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 48 },
  back: { fontSize: 12, fontWeight: "800", color: colors.primary, marginBottom: 14 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 10, marginBottom: 20 },
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.ink, marginBottom: 10 },
  muted: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 6 },
  error: { fontSize: 12, fontWeight: "700", color: colors.danger },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  barLabel: { width: 62, fontSize: 11, fontWeight: "700", color: colors.muted },
  barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.line, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 5, backgroundColor: colors.primary },
  barValue: { width: 28, textAlign: "right", fontSize: 12, fontWeight: "800", color: colors.ink },
  rate: { fontSize: 30, fontWeight: "800", color: colors.ink },
  split: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginTop: 8, backgroundColor: colors.line },
  present: { backgroundColor: colors.primary },
  absent: { backgroundColor: colors.danger },
  pdf: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.primary },
  pdfText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  reportLine: { fontSize: 12, lineHeight: 18, color: colors.ink, marginBottom: 4 },
});
