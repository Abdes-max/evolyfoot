import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { buildDevelopmentPlan, summarizeDiagnostic, type DiagnosticScores, type SavedTrainingSession } from "@evolyfoot/domain";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";

const demoScores: DiagnosticScores = { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 };

export default function SeancesScreen() {
  const { team, diagnosticScores, listSessions } = useAuth();
  const [sessions, setSessions] = useState<readonly SavedTrainingSession[]>([]);
  const plan = buildDevelopmentPlan(summarizeDiagnostic(diagnosticScores ?? demoScores));
  const slotLabels: readonly string[] = team?.trainingDays.length ? team.trainingDays : ["Séance 1"];

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listSessions().then((list) => {
        if (!cancelled) {
          setSessions(list);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [listSessions]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.step}>MES SÉANCES</Text>
        <Text style={styles.title}>Le cycle, séance par séance.</Text>
        {plan.weeks.map((week) => (
          <View key={week.week} style={styles.week}>
            <Text style={styles.weekTitle}>
              Semaine {week.week} · {week.phase}
            </Text>
            <Text style={styles.weekTheme}>{week.theme}</Text>
            {slotLabels.map((label, slot) => {
              const saved = sessions.find((session) => session.weekNumber === week.week && session.slot === slot);
              return (
                <Link asChild href={`/session?week=${week.week}&slot=${slot}`} key={slot}>
                  <TouchableOpacity accessibilityRole="button" style={[styles.slot, saved ? styles.slotSaved : styles.slotFree]}>
                    <Text style={styles.slotLabel}>{label}</Text>
                    <Text style={styles.slotAction}>{saved ? "Ouvrir →" : "Générer →"}</Text>
                  </TouchableOpacity>
                </Link>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 48 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 10, marginBottom: 20 },
  week: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 12 },
  weekTitle: { fontSize: 14, fontWeight: "800", color: colors.ink },
  weekTheme: { fontSize: 11, color: colors.muted, marginTop: 4, marginBottom: 10 },
  slot: {
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    marginTop: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  slotSaved: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  slotFree: { borderColor: colors.line, borderStyle: "dashed" },
  slotLabel: { fontSize: 12, fontWeight: "800", color: colors.ink },
  slotAction: { fontSize: 11, fontWeight: "800", color: colors.primary },
});
