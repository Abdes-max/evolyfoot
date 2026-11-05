import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth, type ObservationListItem } from "../lib/auth-context";
import { eventTypeLabel, levelColor, levelLabel } from "../lib/observation-labels";

export default function ObservationsScreen() {
  const { listObservations } = useAuth();
  const [observations, setObservations] = useState<readonly ObservationListItem[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listObservations().then((list) => {
        if (!cancelled) {
          setObservations(list);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [listObservations]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.step}>OBSERVATIONS</Text>
        <Text style={styles.title}>L’historique de tes observations.</Text>
        {observations === null && <Text style={styles.muted}>Chargement…</Text>}
        {observations?.length === 0 && (
          <Text style={styles.muted}>Aucune observation pour l’instant. Elles apparaissent ici après une séance ou un match.</Text>
        )}
        {observations?.map((observation) => (
          <TouchableOpacity
            accessibilityLabel={`${observation.title}, voir le détail`}
            accessibilityRole="button"
            key={observation.id}
            onPress={() => router.push(`/observations/${observation.id}`)}
            style={styles.card}
          >
            <View style={styles.badges}>
              <Text style={styles.type}>{eventTypeLabel[observation.eventType].toUpperCase()}</Text>
              <Text style={[styles.trend, { color: levelColor[observation.summary.trend] }]}>{levelLabel[observation.summary.trend]}</Text>
            </View>
            <Text style={styles.cardTitle}>{observation.title}</Text>
            <Text style={styles.muted}>{observation.dateLabel}</Text>
          </TouchableOpacity>
        ))}
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
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 10 },
  badges: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  type: { fontSize: 9, fontWeight: "800", color: colors.primary, letterSpacing: 0.8 },
  trend: { fontSize: 11, fontWeight: "800" },
  cardTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, marginTop: 6 },
  muted: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 3 },
});
