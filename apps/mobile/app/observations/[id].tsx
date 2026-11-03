import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { diagnosticCriteria } from "@evolyfoot/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth, type ObservationDetail } from "../../lib/auth-context";
import { eventTypeLabel, levelColor, levelLabel } from "../../lib/observation-labels";

function criterionLabel(criterion: string): string {
  return diagnosticCriteria.find((candidate) => candidate.id === criterion)?.label ?? criterion;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function ObservationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getObservation } = useAuth();
  const [observation, setObservation] = useState<ObservationDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getObservation(id).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setObservation(result.observation);
      } else {
        setError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [getObservation, id]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>← Observations</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!observation && !error && <Text style={styles.muted}>Chargement…</Text>}
        {observation && (
          <>
            <Text style={styles.step}>{eventTypeLabel[observation.eventType].toUpperCase()}</Text>
            <Text style={styles.title}>{observation.title}</Text>
            <Text style={styles.muted}>{observation.dateLabel}</Text>
            {observation.matchId && (
              <TouchableOpacity accessibilityRole="button" onPress={() => router.push(`/match/${observation.matchId}`)}>
                <Text style={styles.link}>Voir le match →</Text>
              </TouchableOpacity>
            )}

            <View style={styles.summary}>
              {[
                ["Score moyen", `${Math.round(observation.summary.averageScore)}/100`],
                ["Tendance", levelLabel[observation.summary.trend]],
                ["Point fort", observation.summary.strongest.label],
                ["À travailler", observation.summary.weakest.label],
              ].map(([label, value]) => (
                <View key={label} style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{label}</Text>
                  <Text style={styles.summaryValue}>{value}</Text>
                </View>
              ))}
            </View>

            <Block title="Comportements observés">
              {observation.ratings.map((rating) => (
                <View key={rating.criterion} style={styles.row}>
                  <Text style={styles.rowLabel}>{criterionLabel(rating.criterion)}</Text>
                  <Text style={[styles.level, { color: levelColor[rating.level] }]}>{levelLabel[rating.level]}</Text>
                </View>
              ))}
            </Block>

            {observation.signals.length > 0 && (
              <Block title="Joueurs à suivre">
                {observation.signals.map((signal) => (
                  <Text key={signal.playerId} style={styles.item}>
                    {signal.playerName} · {signal.kind === "highlight" ? "à mettre en avant" : "à accompagner"}
                  </Text>
                ))}
              </Block>
            )}

            {observation.players.length > 0 && (
              <Block title="Joueurs concernés">
                <Text style={styles.item}>{observation.players.map((player) => player.name).join(", ")}</Text>
              </Block>
            )}

            {observation.note ? (
              <Block title="Note">
                <Text style={styles.item}>{observation.note}</Text>
              </Block>
            ) : null}
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
  title: { fontSize: 26, fontWeight: "800", color: colors.ink, marginTop: 10 },
  muted: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 4 },
  error: { fontSize: 12, fontWeight: "700", color: colors.danger },
  link: { fontSize: 12, fontWeight: "800", color: colors.primary, marginTop: 10 },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 16 },
  summaryItem: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  summaryLabel: { fontSize: 9, fontWeight: "800", color: colors.muted },
  summaryValue: { fontSize: 13, fontWeight: "800", color: colors.ink, marginTop: 4 },
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, marginBottom: 6 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  rowLabel: { flex: 1, fontSize: 12, color: colors.ink },
  level: { fontSize: 11, fontWeight: "800" },
  item: { fontSize: 12, lineHeight: 18, color: colors.ink },
});
