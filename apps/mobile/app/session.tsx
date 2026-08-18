import {
  adjustBlockDuration,
  buildDevelopmentPlan,
  canReplaceSessionActivity,
  canValidateSession,
  generateTrainingSession,
  getSessionDuration,
  moveSessionBlock,
  replaceSessionActivity,
  summarizeDiagnostic,
} from "@evolyfoot/domain";
import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { Link } from "expo-router";
import { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const kindLabels = { welcome: "Accueil", activation: "Activation", main: "Situation principale", game: "Jeu" } as const;

const plan = buildDevelopmentPlan(
  summarizeDiagnostic({ availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 }),
);
const initialSession = generateTrainingSession(plan.weeks[0], "U12", 14);

export default function SessionScreen() {
  const [session, setSession] = useState(initialSession);
  const [validationStatus, setValidationStatus] = useState("");
  const duration = getSessionDuration(session);
  const canValidate = canValidateSession(session);

  function editSession(nextSession: typeof session) {
    setSession(nextSession);
    setValidationStatus("");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.step}>SÉANCE 1 · SEMAINE 1</Text>
        <Text style={styles.title}>Prépare ta première séance.</Text>
        <Text style={styles.body}>{session.intention}</Text>

        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryLabel}>DÉROULÉ MODULABLE</Text>
            <Text style={styles.summaryTitle}>{session.title}</Text>
            <Text style={styles.summaryTheme}>{session.theme} · {session.playerCount} joueurs</Text>
          </View>
          <Text accessibilityLabel={`Durée totale : ${duration} minutes`} accessibilityLiveRegion="polite" style={styles.duration}>{duration} min</Text>
        </View>

        {session.blocks.map((block, index) => {
          const canReplace = canReplaceSessionActivity(session, index);
          return (
          <View style={styles.card} key={block.id}>
            <View style={styles.cardHeading}>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.blockNumber}>{index + 1}</Text>
                <View style={styles.cardContent}>
                  <Text style={styles.kind}>{kindLabels[block.activity.kind]}</Text>
                  <Text style={styles.cardTitle}>{block.activity.title}</Text>
                </View>
              </View>
              <Text style={styles.blockDuration}>{block.durationMinutes} min</Text>
            </View>
            <Text style={styles.objective}>{block.activity.objective}</Text>
            <View style={styles.details}>
              <Text style={styles.detailLabel}>ORGANISATION</Text><Text style={styles.detailText}>{block.activity.organization}</Text>
              <Text style={styles.detailLabel}>CONSIGNE</Text><Text style={styles.detailText}>{block.activity.instruction}</Text>
              <Text style={styles.detailLabel}>À OBSERVER</Text><Text style={styles.detailText}>{block.activity.observable}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                accessibilityLabel="Retirer 5 minutes"
                hitSlop={8}
                onPress={() => editSession(adjustBlockDuration(session, index, -5))}
                style={styles.action}
              >
                <Text style={styles.actionText}>− 5 min</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Ajouter 5 minutes"
                hitSlop={8}
                onPress={() => editSession(adjustBlockDuration(session, index, 5))}
                style={styles.action}
              >
                <Text style={styles.actionText}>+ 5 min</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Monter"
                hitSlop={8}
                disabled={index === 0}
                onPress={() => editSession(moveSessionBlock(session, index, index - 1))}
                style={[styles.action, index === 0 && styles.actionDisabled]}
              >
                <Text style={styles.actionText}>Monter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Descendre"
                hitSlop={8}
                disabled={index === session.blocks.length - 1}
                onPress={() => editSession(moveSessionBlock(session, index, index + 1))}
                style={[styles.action, index === session.blocks.length - 1 && styles.actionDisabled]}
              >
                <Text style={styles.actionText}>Descendre</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Remplacer la situation"
                accessibilityHint={canReplace ? "Affiche une autre situation compatible." : "Aucune autre situation compatible pour ce bloc."}
                disabled={!canReplace}
                hitSlop={8}
                onPress={() => editSession(replaceSessionActivity(session, index))}
                style={[styles.action, !canReplace && styles.actionDisabled]}
              >
                <Text style={styles.actionText}>Remplacer</Text>
              </TouchableOpacity>
            </View>
          </View>
        );})}

        {!canValidate && <Text style={styles.warning}>La séance doit durer entre 60 et 90 minutes.</Text>}
        <TouchableOpacity
          accessibilityLabel="Valider cette séance"
          disabled={!canValidate}
          onPress={() => setValidationStatus("Séance prête")}
          style={[styles.validate, !canValidate && styles.validateDisabled]}
        >
          <Text style={styles.validateText}>Valider cette séance →</Text>
        </TouchableOpacity>
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.status}>{validationStatus}</Text>
        {validationStatus && (
          <Link href="/observation?type=training" asChild>
            <TouchableOpacity accessibilityRole="button" style={styles.observationLink}>
              <Text style={styles.observationLinkText}>Observer cette séance →</Text>
            </TouchableOpacity>
          </Link>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 50 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  title: { fontSize: 30, fontWeight: "800", color: colors.ink, marginTop: 10 },
  body: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 8, marginBottom: 24 },
  summary: { flexDirection: "row", justifyContent: "space-between", gap: 16, padding: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radii.md, marginBottom: 16 },
  summaryLabel: { fontSize: 9, letterSpacing: 1, fontWeight: "800", color: colors.primary },
  summaryTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, marginTop: 5 },
  summaryTheme: { fontSize: 11, color: colors.muted, marginTop: 4 },
  duration: { fontSize: 18, fontWeight: "800", color: colors.primary },
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 10 },
  cardHeading: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  cardTitleWrap: { flex: 1, flexDirection: "row", gap: 10 },
  blockNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft, color: colors.primary, fontSize: 11, fontWeight: "800", textAlign: "center", textAlignVertical: "center" },
  cardContent: { flex: 1 },
  kind: { fontSize: 9, fontWeight: "800", color: colors.primary, textTransform: "uppercase" },
  cardTitle: { fontSize: 14, lineHeight: 19, fontWeight: "800", color: colors.ink, marginTop: 3 },
  blockDuration: { fontSize: 12, fontWeight: "800", color: colors.ink },
  objective: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 12 },
  details: { marginTop: 12, padding: 12, backgroundColor: colors.paper, borderRadius: radii.sm },
  detailLabel: { fontSize: 9, fontWeight: "800", color: colors.primary, marginTop: 6 },
  detailText: { fontSize: 10, lineHeight: 15, color: colors.muted, marginTop: 3 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  action: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.paper, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line },
  actionDisabled: { opacity: 0.4 },
  actionText: { fontSize: 10, fontWeight: "800", color: colors.ink },
  warning: { fontSize: 12, lineHeight: 18, color: "#a63d2e", marginTop: 8, marginBottom: 12 },
  validate: { alignItems: "center", backgroundColor: colors.ink, borderRadius: radii.sm, marginTop: 8, padding: 15 },
  validateDisabled: { opacity: 0.45 },
  validateText: { fontSize: 12, fontWeight: "800", color: "white" },
  status: { minHeight: 18, fontSize: 12, fontWeight: "800", color: colors.primary, marginTop: 12, textAlign: "center" },
  observationLink: { minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.primary, borderRadius: radii.sm, marginTop: 12, paddingHorizontal: 14, backgroundColor: colors.primarySoft },
  observationLinkText: { fontSize: 12, fontWeight: "800", color: colors.primary },
});
