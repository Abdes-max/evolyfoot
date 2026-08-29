import { buildDevelopmentPlan, summarizeDiagnostic, type DiagnosticScores } from "@evolyfoot/domain";
import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { Link } from "expo-router";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";

// Diagnostic de démonstration, utilisé tant que l'éducateur connecté n'a pas encore fait le
// sien (mobile est entièrement protégé par connexion -- voir _layout.tsx -- donc jamais utilisé
// pour un visiteur anonyme).
const demoScores: DiagnosticScores = { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 };

export default function PlanScreen() {
  const { diagnosticScores } = useAuth();
  const plan = buildDevelopmentPlan(summarizeDiagnostic(diagnosticScores ?? demoScores));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.step}>ÉTAPE 3 SUR 3</Text>
        <Text style={styles.title}>Ton premier cycle est prêt.</Text>
        <Text style={styles.body}>{plan.explanation}</Text>
        {plan.weeks.map((week) => (
          <View key={week.week} style={styles.card}>
            <View style={styles.number}>
              <Text style={styles.numberText}>S{week.week}</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.phase}>{week.phase.toUpperCase()}</Text>
              <Text style={styles.intention}>{week.intention}</Text>
              <Text style={styles.observable}>{week.observable}</Text>
            </View>
          </View>
        ))}
        <Link asChild href="/session">
          <TouchableOpacity style={styles.sessionButton}>
            <Text style={styles.sessionButtonText}>Préparer la première séance →</Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 50 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary },
  title: { fontSize: 30, fontWeight: "800", color: colors.ink, marginTop: 10 },
  body: { fontSize: 12, lineHeight: 19, color: colors.muted, marginTop: 8, marginBottom: 24 },
  card: { flexDirection: "row", gap: 12, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 10 },
  number: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  numberText: { fontWeight: "800", color: colors.primary },
  content: { flex: 1 },
  phase: { fontSize: 8, fontWeight: "800", color: colors.primary },
  intention: { fontSize: 13, fontWeight: "800", color: colors.ink, marginTop: 5 },
  observable: { fontSize: 9, lineHeight: 14, color: colors.muted, marginTop: 6 },
  sessionButton: { alignItems: "center", justifyContent: "center", minHeight: 44, backgroundColor: colors.primary, borderRadius: radii.sm, marginTop: 14, padding: 15 },
  sessionButtonText: { color: colors.primaryInk, fontSize: 12, fontWeight: "800" },
});
