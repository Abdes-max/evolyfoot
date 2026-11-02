import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { trainingActivityCatalogue, type DevelopmentTheme, type PersonalExercise, type TrainingBlockKind } from "@evolyfoot/domain";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { useAuth } from "../lib/auth-context";
import { kindLabels } from "../lib/exercise-labels";

const kindFilters: readonly (TrainingBlockKind | "all")[] = ["all", "welcome", "activation", "main", "game"];
const themeFilters: readonly (DevelopmentTheme | "all")[] = ["all", "Conserver le ballon", "Progresser ensemble", "Finir les actions", "Récupérer rapidement"];

function matches(item: { title: string; objective: string }, query: string): boolean {
  return `${item.title} ${item.objective}`.toLowerCase().includes(query.trim().toLowerCase());
}

function Chips<Value extends string>({ values, active, label, onChange }: { values: readonly Value[]; active: Value; label: (value: Value) => string; onChange: (value: Value) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.chips} horizontal showsHorizontalScrollIndicator={false}>
      {values.map((value) => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: value === active }}
          key={value}
          onPress={() => onChange(value)}
          style={[styles.chip, value === active && styles.chipActive]}
        >
          <Text style={styles.chipText}>{label(value)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function Card({ id, kind, meta, title, objective }: { id: string; kind: TrainingBlockKind; meta: string; title: string; objective: string }) {
  return (
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push(`/bibliotheque/${id}`)} style={styles.card}>
      <Text style={styles.meta}>
        {kindLabels[kind].toUpperCase()} · {meta}
      </Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text numberOfLines={2} style={styles.muted}>
        {objective}
      </Text>
    </TouchableOpacity>
  );
}

export default function BibliothequeScreen() {
  const { listPersonalExercises } = useAuth();
  const [personal, setPersonal] = useState<readonly PersonalExercise[]>([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<TrainingBlockKind | "all">("all");
  const [theme, setTheme] = useState<DevelopmentTheme | "all">("all");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listPersonalExercises().then((list) => {
        if (!cancelled) {
          setPersonal(list);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [listPersonalExercises]),
  );

  const activities = useMemo(
    () =>
      trainingActivityCatalogue.filter(
        (activity) => (kind === "all" || activity.kind === kind) && (theme === "all" || activity.compatibleThemes.includes(theme)) && matches(activity, query),
      ),
    [kind, query, theme],
  );
  const mine = personal.filter((exercise) => (kind === "all" || exercise.kind === kind) && (theme === "all" || exercise.theme === theme) && matches(exercise, query));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.step}>BIBLIOTHÈQUE</Text>
        <Text style={styles.title}>Toutes tes situations d’entraînement.</Text>
        <TextInput
          accessibilityLabel="Rechercher une situation"
          onChangeText={setQuery}
          placeholder="Rechercher une situation…"
          placeholderTextColor={colors.muted}
          style={styles.search}
          value={query}
        />
        <Chips active={kind} label={(value) => (value === "all" ? "Toutes" : kindLabels[value])} onChange={setKind} values={kindFilters} />
        <Chips active={theme} label={(value) => (value === "all" ? "Tous les thèmes" : value)} onChange={setTheme} values={themeFilters} />

        {mine.length > 0 && (
          <>
            <Text style={styles.section}>Mes exercices</Text>
            {mine.map((exercise) => (
              <Card id={exercise.id} key={exercise.id} kind={exercise.kind} meta={exercise.theme} objective={exercise.objective} title={exercise.title} />
            ))}
            <Text style={styles.section}>Le catalogue EvolyFoot</Text>
          </>
        )}
        {activities.length === 0 && mine.length === 0 && <Text style={styles.muted}>Aucune situation ne correspond à ta recherche.</Text>}
        {activities.map((activity) => (
          <Card id={activity.id} key={activity.id} kind={activity.kind} meta={activity.fieldSize} objective={activity.objective} title={activity.title} />
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
  title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 10, marginBottom: 16 },
  search: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm, padding: 12, color: colors.ink },
  chips: { gap: 6, paddingVertical: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 11, fontWeight: "700", color: colors.ink },
  section: { fontSize: 13, fontWeight: "800", color: colors.ink, marginTop: 14, marginBottom: 8 },
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginTop: 8 },
  meta: { fontSize: 9, fontWeight: "800", color: colors.primary, letterSpacing: 0.6 },
  cardTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, marginTop: 5 },
  muted: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 4 },
});
