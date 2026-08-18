import {
  canCompleteObservation,
  completeObservation,
  createObservationDraft,
  diagnosticCriteria,
  rateObservation,
  setObservationNote,
  suggestAdjustmentFromObservation,
  togglePlayerSignal,
  type AdjustmentSuggestion,
  type DevelopmentWeek,
  type ObservationDraft,
  type ObservationEventType,
  type ObservationLevel,
  type ObservationReport,
  type PlayerReference,
} from "@evolyfoot/domain";
import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { AccessibilityInfo, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdjustmentCard } from "../components/adjustment-card";

const demoPlayers: readonly PlayerReference[] = [
  { id: "lina-dupont", name: "Lina" },
  { id: "noah-martin", name: "Noah" },
  { id: "sami-bernard", name: "Sami" },
];

const eventOptions: readonly { type: ObservationEventType; label: string }[] = [
  { type: "training", label: "Après une séance" },
  { type: "match", label: "Après un match" },
];

const levels: readonly { value: ObservationLevel; label: string }[] = [
  { value: "reinforce", label: "À renforcer" },
  { value: "progress", label: "En progrès" },
  { value: "achieved", label: "Acquis aujourd’hui" },
];

const levelText: Record<ObservationLevel, string> = {
  reinforce: "à renforcer",
  progress: "en progrès",
  achieved: "acquise aujourd’hui",
};

const currentWeek: DevelopmentWeek = {
  week: 2,
  phase: "Stabiliser",
  theme: "Progresser ensemble",
  intention: "Répéter le comportement dans des situations variées.",
  observable: "Le comportement apparaît sans rappel dans 1 action sur 2.",
};

function eventTitle(type: ObservationEventType) {
  return type === "match" ? "Observation de match" : "Observation de séance";
}

function createDraft(type: ObservationEventType) {
  return createObservationDraft(type, eventTitle(type), demoPlayers);
}

export default function ObservationScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const initialEventType: ObservationEventType = type === "match" ? "match" : "training";
  const [draft, setDraft] = useState<ObservationDraft>(() => createDraft(initialEventType));
  const [report, setReport] = useState<ObservationReport>();
  const [suggestion, setSuggestion] = useState<AdjustmentSuggestion>();
  const complete = canCompleteObservation(draft);
  const remaining = diagnosticCriteria.length - draft.ratings.length;

  function editDraft(nextDraft: ObservationDraft) {
    setDraft(nextDraft);
    setReport(undefined);
    setSuggestion(undefined);
  }

  function validateObservation() {
    if (!complete) return;

    const nextReport = completeObservation(draft);
    setReport(nextReport);
    setSuggestion(suggestAdjustmentFromObservation(nextReport, currentWeek));

    if (Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(`Observation validée. Tendance ${levelText[nextReport.summary.trend]}.`);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerStep}>OBSERVATION RAPIDE</Text>
          <Text style={styles.title}>Ce que tu as vu aujourd’hui.</Text>
          <Text style={styles.headerBody}>Garde une trace simple des comportements collectifs et des joueurs à retenir.</Text>
        </View>

        <View style={styles.intro}>
          <Text style={styles.step}>EN MOINS DE TROIS MINUTES</Text>
          <Text style={styles.sectionTitle}>Une lecture utile du terrain</Text>
          <Text style={styles.body}>Les quatre comportements donnent une tendance collective. Les joueurs restent facultatifs.</Text>
        </View>

        <Text style={styles.label}>Quel moment observes-tu ?</Text>
        <View style={styles.choiceRow}>
          {eventOptions.map((option) => {
            const selected = draft.eventType === option.type;
            return (
              <TouchableOpacity
                accessibilityLabel={option.label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                hitSlop={8}
                key={option.type}
                onPress={() => editDraft(createDraft(option.type))}
                style={[styles.eventChoice, selected && styles.selectedChoice]}
              >
                <Text style={[styles.eventChoiceText, selected && styles.selectedChoiceText]}>{selected ? `${option.label} · sélectionné` : option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.collectiveHeading}>
          <Text style={styles.step}>COLLECTIF</Text>
          <Text style={styles.sectionTitle}>Les comportements du groupe</Text>
        </View>
        {diagnosticCriteria.map((criterion) => {
          const selectedLevel = draft.ratings.find((rating) => rating.criterion === criterion.id)?.level;
          return (
            <View key={criterion.id} style={styles.card}>
              <Text style={styles.cardTitle}>{criterion.label}</Text>
              <Text style={styles.cardBody}>{criterion.description}</Text>
              <View style={styles.levels}>
                {levels.map((level) => {
                  const selected = selectedLevel === level.value;
                  return (
                    <TouchableOpacity
                      accessibilityLabel={`${criterion.label} : ${level.label}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      hitSlop={8}
                      key={level.value}
                      onPress={() => editDraft(rateObservation(draft, criterion.id, level.value))}
                      style={[styles.level, selected && styles.selectedChoice]}
                    >
                      <Text style={[styles.levelText, selected && styles.selectedChoiceText]}>{selected ? `${level.label} · sélectionné` : level.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={styles.players}>
          <Text style={styles.step}>FACULTATIF</Text>
          <Text style={styles.sectionTitle}>Joueurs à retenir</Text>
          <Text style={styles.body}>Un même joueur ne peut recevoir qu’un seul signal.</Text>
          {draft.players.map((player) => {
            const signal = draft.signals.find((candidate) => candidate.playerId === player.id)?.kind;
            return (
              <View key={player.id} style={styles.playerRow}>
                <Text style={styles.playerName}>{player.name}</Text>
                <View style={styles.playerActions}>
                  <TouchableOpacity
                    accessibilityLabel={`Mettre ${player.name} en réussite à retenir`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: signal === "highlight" }}
                    hitSlop={8}
                    onPress={() => editDraft(togglePlayerSignal(draft, player, "highlight"))}
                    style={[styles.playerAction, signal === "highlight" && styles.highlight]}
                  >
                    <Text style={styles.playerActionText}>{signal === "highlight" ? "Réussite à retenir · sélectionné" : "Réussite à retenir"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel={`Signaler ${player.name} pour un accompagnement`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: signal === "support" }}
                    hitSlop={8}
                    onPress={() => editDraft(togglePlayerSignal(draft, player, "support"))}
                    style={[styles.playerAction, signal === "support" && styles.support]}
                  >
                    <Text style={styles.playerActionText}>{signal === "support" ? "À accompagner · sélectionné" : "À accompagner"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          <Text style={styles.label}>Une note si elle aide à te souvenir</Text>
          <TextInput
            accessibilityLabel="Une note si elle aide à te souvenir"
            maxLength={280}
            multiline
            onChangeText={(note) => editDraft(setObservationNote(draft, note))}
            placeholder="Un fait marquant, une situation à revoir…"
            style={styles.input}
            value={draft.note ?? ""}
          />
          <Text style={styles.counter}>{`${draft.note?.length ?? 0}/280 caractères`}</Text>
        </View>

        <TouchableOpacity
          accessibilityHint={complete ? "Valide et affiche la synthèse de l’observation." : `${remaining} comportement${remaining > 1 ? "s" : ""} reste${remaining > 1 ? "nt" : ""} à renseigner.`}
          accessibilityLabel="Valider l’observation"
          accessibilityRole="button"
          accessibilityState={{ disabled: !complete }}
          disabled={!complete}
          onPress={validateObservation}
          style={[styles.validate, !complete && styles.validateDisabled]}
        >
          <Text style={styles.validateText}>Valider l’observation →</Text>
        </TouchableOpacity>
        {!complete && <Text style={styles.remaining}>{`${remaining} comportement${remaining > 1 ? "s" : ""} reste${remaining > 1 ? "nt" : ""} à renseigner.`}</Text>}

        {report && (
          <View accessibilityLiveRegion="polite" style={styles.result}>
            <Text style={styles.step}>SYNTHÈSE EVOLY</Text>
            <Text style={styles.resultTitle}>{`Tendance ${levelText[report.summary.trend]}`}</Text>
            <Text style={styles.resultLabel}>Point fort</Text>
            <Text style={styles.resultValue}>{report.summary.strongest.label}</Text>
            <Text style={styles.resultLabel}>Priorité à renforcer</Text>
            <Text style={styles.resultValue}>{report.summary.weakest.label}</Text>
            <Text style={styles.resultLabel}>Joueurs signalés</Text>
            <Text style={styles.resultValue}>{`${report.signals.length} joueur${report.signals.length > 1 ? "s" : ""} signalé${report.signals.length > 1 ? "s" : ""}`}</Text>
          </View>
        )}
        {suggestion && <AdjustmentCard suggestion={suggestion} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 50 },
  header: { padding: spacing.lg, backgroundColor: colors.primary, borderRadius: radii.lg, marginBottom: 20 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  headerStep: { fontSize: 10, fontWeight: "800", color: "#c2decf", letterSpacing: 1.1 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "800", color: "white", marginTop: 12 },
  body: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 7 },
  headerBody: { fontSize: 13, lineHeight: 20, color: "#cfe0d6", marginTop: 7 },
  intro: { marginBottom: 20 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800", color: colors.ink, marginTop: 5 },
  label: { fontSize: 12, fontWeight: "800", color: colors.ink, marginBottom: 8, marginTop: 18 },
  choiceRow: { flexDirection: "row", gap: 8 },
  eventChoice: { flex: 1, minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", padding: 10, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  selectedChoice: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  eventChoiceText: { color: colors.muted, fontSize: 11, fontWeight: "800", textAlign: "center" },
  selectedChoiceText: { color: colors.primary },
  collectiveHeading: { marginTop: 28, marginBottom: 8 },
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginTop: 10 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  cardBody: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 5 },
  levels: { gap: 7, marginTop: 14 },
  level: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  levelText: { fontSize: 12, fontWeight: "800", color: colors.ink },
  players: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginTop: 24 },
  playerRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, marginTop: 12 },
  playerName: { fontSize: 14, fontWeight: "800", color: colors.ink },
  playerActions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 },
  playerAction: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: 10, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  playerActionText: { fontSize: 10, fontWeight: "800", color: colors.ink },
  highlight: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  support: { borderColor: "#a66f16", backgroundColor: "#fff0cb" },
  input: { minHeight: 96, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, backgroundColor: colors.paper, color: colors.ink, fontSize: 13, lineHeight: 19, padding: 12, textAlignVertical: "top" },
  counter: { color: colors.muted, fontSize: 10, marginTop: 6, textAlign: "right" },
  validate: { minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink, borderRadius: radii.sm, marginTop: 20, paddingHorizontal: 14 },
  validateDisabled: { opacity: 0.45 },
  validateText: { fontSize: 12, fontWeight: "800", color: "white" },
  remaining: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8, textAlign: "center" },
  result: { padding: spacing.lg, backgroundColor: colors.primarySoft, borderRadius: radii.md, marginTop: 20 },
  resultTitle: { color: colors.primary, fontSize: 22, fontWeight: "800", marginTop: 8 },
  resultLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.8, marginTop: 16, textTransform: "uppercase" },
  resultValue: { color: colors.ink, fontSize: 14, fontWeight: "800", marginTop: 3 },
});
