import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import {
  fieldClock,
  fieldSteps,
  goToFieldStep,
  nextFieldStep,
  rehydrateTrainingSession,
  scoreField,
  startField,
  tickField,
  toggleField,
  type FieldState,
  type SavedTrainingSession,
  type TrainingSession,
} from "@evolyfoot/domain";
import { router, useLocalSearchParams } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, Vibration, View } from "react-native";
import { TacticalPlayer } from "../../components/tactical-player";
import { useAuth } from "../../lib/auth-context";

// Mode terrain : une situation à la fois, gros minuteur par séquence et défi entre deux équipes.
export default function FieldModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiRequest, listPersonalExercises } = useAuth();
  const [session, setSession] = useState<TrainingSession | null | undefined>(undefined);
  const steps = useMemo(() => (session ? fieldSteps(session) : []), [session]);
  const [state, setState] = useState<FieldState | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [response, personal] = await Promise.all([apiRequest(`/api/sessions/${encodeURIComponent(id)}`), listPersonalExercises()]);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (cancelled) return;
      const record: SavedTrainingSession | null = body?.session ?? null;
      const rehydrated = record ? rehydrateTrainingSession(record, personal) : null;
      setSession(rehydrated);
      if (rehydrated) setState(startField(fieldSteps(rehydrated)));
    })();
    return () => {
      cancelled = true;
    };
  }, [apiRequest, listPersonalExercises, id]);

  useEffect(() => {
    if (!state?.running) return;
    const timer = setInterval(() => setState((current) => (current ? tickField(current) : current)), 1000);
    return () => clearInterval(timer);
  }, [state?.running]);

  // L’écran reste allumé pendant que le minuteur tourne.
  useEffect(() => {
    if (!state?.running) return;
    activateKeepAwakeAsync("terrain").catch(() => undefined);
    return () => {
      deactivateKeepAwake("terrain").catch(() => undefined);
    };
  }, [state?.running]);

  const ended = state?.remaining === 0;
  useEffect(() => {
    if (ended) Vibration.vibrate([0, 300, 150, 300]);
  }, [ended, state?.step, state?.sequence]);

  if (session === undefined) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.muted}>Chargement de la séance…</Text>
      </SafeAreaView>
    );
  }
  if (!session || !state) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.page}>
          <Text style={styles.muted}>Cette séance est introuvable.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const block = session.blocks[state.step]!;
  const step = steps[state.step]!;
  const last = state.step === steps.length - 1 && state.sequence === step.sequenceCount;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.head}>
          <TouchableOpacity accessibilityRole="button" hitSlop={8} onPress={() => router.back()}>
            <Text style={styles.back}>← Quitter</Text>
          </TouchableOpacity>
          <Text style={styles.muted}>
            Situation {state.step + 1}/{steps.length}
          </Text>
        </View>

        <Text style={styles.title}>{block.activity.title}</Text>
        <Text style={styles.body}>{block.activity.instruction}</Text>

        <View accessibilityLiveRegion="polite" style={styles.timer}>
          <Text style={styles.muted}>
            Séquence {state.sequence}/{step.sequenceCount}
          </Text>
          <Text style={[styles.clock, ended && styles.clockEnded]}>{fieldClock(state.remaining)}</Text>
          {ended && <Text style={styles.body}>{last ? "Séance terminée, bravo !" : "Séquence terminée"}</Text>}
        </View>

        {ended ? (
          !last && (
            <TouchableOpacity accessibilityRole="button" onPress={() => setState(nextFieldStep(steps, state))} style={styles.primary}>
              <Text style={styles.primaryText}>{state.sequence < step.sequenceCount ? "Séquence suivante" : "Situation suivante"}</Text>
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity accessibilityRole="button" onPress={() => setState(toggleField(state))} style={styles.primary}>
            <Text style={styles.primaryText}>{state.running ? "Pause" : "Démarrer"}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.scores}>
          {(["Équipe A", "Équipe B"] as const).map((team, index) => (
            <View key={team} style={styles.scoreCard}>
              <Text style={styles.muted}>{team}</Text>
              <Text style={styles.score}>{state.scores[index]}</Text>
              <View style={styles.scoreButtons}>
                <TouchableOpacity
                  accessibilityLabel={`Retirer un point à ${team}`}
                  accessibilityRole="button"
                  onPress={() => setState(scoreField(state, index as 0 | 1, -1))}
                  style={styles.scoreButton}
                >
                  <Text style={styles.scoreButtonText}>−</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel={`Ajouter un point à ${team}`}
                  accessibilityRole="button"
                  onPress={() => setState(scoreField(state, index as 0 | 1, 1))}
                  style={styles.scoreButton}
                >
                  <Text style={styles.scoreButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity accessibilityRole="button" onPress={() => setShowDetails((value) => !value)}>
          <Text style={styles.link}>{showDetails ? "Masquer le schéma et les règles" : "Voir le schéma et les règles"}</Text>
        </TouchableOpacity>
        {showDetails && (
          <View style={styles.details}>
            <TacticalPlayer exercise={block.activity} seed={block.activity.id} />
            {block.activity.rules.map((rule) => (
              <Text key={rule} style={styles.muted}>
                • {rule}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.nav}>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={state.step === 0}
            onPress={() => setState(goToFieldStep(steps, state.step - 1))}
            style={[styles.navButton, state.step === 0 && styles.disabled]}
          >
            <Text style={styles.actionText}>← Précédente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={state.step === steps.length - 1}
            onPress={() => setState(goToFieldStep(steps, state.step + 1))}
            style={[styles.navButton, state.step === steps.length - 1 && styles.disabled]}
          >
            <Text style={styles.actionText}>Suivante →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 48, gap: 14 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { fontSize: 13, fontWeight: "800", color: colors.primary },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink },
  body: { fontSize: 15, lineHeight: 21, color: colors.ink },
  muted: { fontSize: 12, lineHeight: 17, color: colors.muted },
  link: { fontSize: 13, fontWeight: "800", color: colors.primary },
  timer: { alignItems: "center", padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  clock: { fontSize: 88, fontWeight: "800", color: colors.ink, fontVariant: ["tabular-nums"] },
  clockEnded: { color: colors.primary },
  primary: { minHeight: 64, alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: colors.primary },
  primaryText: { fontSize: 18, fontWeight: "800", color: colors.primaryInk },
  scores: { flexDirection: "row", gap: 12 },
  scoreCard: { flex: 1, alignItems: "center", padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  score: { fontSize: 40, fontWeight: "800", color: colors.ink },
  scoreButtons: { flexDirection: "row", gap: 8, marginTop: 6 },
  scoreButton: {
    minWidth: 52,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  scoreButtonText: { fontSize: 22, fontWeight: "800", color: colors.ink },
  details: { gap: 6 },
  nav: { flexDirection: "row", gap: 12 },
  navButton: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line },
  actionText: { fontSize: 13, fontWeight: "800", color: colors.ink },
  disabled: { opacity: 0.4 },
});
