import { diagnosticCriteria, summarizeDiagnostic, type DiagnosticScores } from "@evolyfoot/domain";
import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router } from "expo-router";
import { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";

const initialScores: DiagnosticScores = { availability: 2, scanning: 2, progression: 2, reactionAfterLoss: 2 };

export default function DiagnosticScreen() {
  const { diagnosticScores, saveDiagnostic } = useAuth();
  // Le diagnostic déjà enregistré (s'il existe) est résolu avant que cet écran ne soit
  // atteignable -- voir AuthContext.login -- donc un état paresseux suffit, comme pour le
  // préremplissage de l'équipe dans onboarding.tsx.
  const [scores, setScores] = useState<DiagnosticScores>(() => diagnosticScores ?? initialScores);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const summary = summarizeDiagnostic(scores);

  async function submit() {
    setSaveError("");
    setSaving(true);
    const result = await saveDiagnostic(scores);
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.step}>ÉTAPE 2 SUR 3</Text>
        <Text style={styles.title}>Où en est ton équipe ?</Text>
        <Text style={styles.body}>Évalue les comportements observés récemment.</Text>
        {diagnosticCriteria.map((criterion) => (
          <View key={criterion.id} style={styles.card}>
            <Text style={styles.label}>{criterion.label}</Text>
            <Text style={styles.description}>{criterion.description}</Text>
            <View style={styles.rating}>
              {[1, 2, 3, 4].map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => {
                    setScores({ ...scores, [criterion.id]: value });
                    setDone(false);
                  }}
                  style={[styles.score, scores[criterion.id] === value && styles.active]}
                >
                  <Text style={styles.scoreText}>{value}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

        <TouchableOpacity disabled={saving} onPress={submit} style={styles.button}>
          <Text style={styles.buttonText}>{saving ? "Enregistrement…" : "Voir mes priorités"}</Text>
        </TouchableOpacity>
        {done && (
          <View style={styles.result}>
            <Text style={styles.label}>PRIORITÉS EVOLY</Text>
            {summary.priorities.map((item) => (
              <Text key={item.criterion} style={styles.priority}>
                {item.label} · {item.theme}
              </Text>
            ))}
            <TouchableOpacity onPress={() => router.push("/plan")} style={styles.button}>
              <Text style={styles.buttonText}>Construire mon cycle</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 50 },
  step: { color: colors.primary, fontSize: 10, fontWeight: "800" },
  title: { fontSize: 30, fontWeight: "800", color: colors.ink, marginTop: 10 },
  body: { color: colors.muted, fontSize: 12, marginTop: 8, marginBottom: 20 },
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: "800", color: colors.ink },
  description: { fontSize: 10, color: colors.muted, marginTop: 5 },
  rating: { flexDirection: "row", gap: 8, marginTop: 14 },
  score: { flex: 1, alignItems: "center", padding: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm },
  active: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  scoreText: { fontWeight: "800", color: colors.primary },
  error: { color: colors.danger, fontSize: 11, marginTop: 6, marginBottom: 6 },
  button: { padding: 15, minHeight: 44, backgroundColor: colors.primary, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", marginTop: 10 },
  buttonText: { color: colors.primaryInk, fontSize: 11, fontWeight: "800" },
  result: { padding: spacing.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, marginTop: 14 },
  priority: { fontSize: 11, color: colors.primary, fontWeight: "700", marginTop: 9 },
});
