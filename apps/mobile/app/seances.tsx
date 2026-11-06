import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { buildDevelopmentPlan, summarizeDiagnostic, type DiagnosticScores, type SavedTrainingSession } from "@evolyfoot/domain";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ConvocationSettings } from "../components/convocation-settings";
import { CalendarIcon } from "../components/icons";
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
        <ConvocationSettings />
        {plan.weeks.map((week) => (
          <View key={week.week} style={styles.week}>
            <Text style={styles.weekTitle}>
              Semaine {week.week} · {week.phase}
            </Text>
            <Text style={styles.weekTheme}>{week.theme}</Text>
            {slotLabels.map((label, slot) => {
              const saved = sessions.find((session) => session.weekNumber === week.week && session.slot === slot);
              return (
                // Un vrai bouton par créneau : icône, jour, statut et action. router.push plutôt
                // qu’un <Link asChild> (dont le style en tableau fait planter le rendu web).
                <TouchableOpacity
                  accessibilityHint={saved ? "Ouvre la séance préparée" : "Génère la séance à partir du plan"}
                  accessibilityLabel={`${label}, semaine ${week.week} : ${saved ? "séance prête" : "à générer"}`}
                  accessibilityRole="button"
                  key={slot}
                  onPress={() => router.push(`/session?week=${week.week}&slot=${slot}`)}
                  style={[styles.slot, saved ? styles.slotSaved : styles.slotFree]}
                >
                  <View style={[styles.slotIcon, saved && styles.slotIconSaved]}>
                    <CalendarIcon color={saved ? colors.primaryInk : colors.primary} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slotLabel}>{label}</Text>
                    <Text style={styles.slotStatus}>{saved ? (saved.title ?? "Séance prête") : "À générer"}</Text>
                  </View>
                  <View style={[styles.slotButton, saved ? styles.slotButtonSaved : styles.slotButtonFree]}>
                    <Text style={[styles.slotButtonText, !saved && styles.slotButtonTextFree]}>{saved ? "Ouvrir" : "Générer"}</Text>
                  </View>
                </TouchableOpacity>
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
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    marginTop: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  slotSaved: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  slotFree: { borderColor: colors.line, backgroundColor: colors.paper },
  slotIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  slotIconSaved: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotLabel: { fontSize: 14, fontWeight: "800", color: colors.ink },
  slotStatus: { fontSize: 12, color: colors.muted, marginTop: 2 },
  slotButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radii.pill },
  slotButtonSaved: { backgroundColor: colors.primary },
  slotButtonFree: { borderWidth: 1, borderColor: colors.primary },
  slotButtonText: { fontSize: 12, fontWeight: "900", color: colors.primaryInk },
  slotButtonTextFree: { color: colors.primary },
});
