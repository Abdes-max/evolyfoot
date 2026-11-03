import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { findTrainingActivity, type PersonalExercise, type TrainingActivity } from "@evolyfoot/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { TacticalPlayer } from "../../components/tactical-player";
import { useAuth } from "../../lib/auth-context";
import { kindLabels } from "../../lib/exercise-labels";

function Block({ title, text, items }: { title: string; text?: string; items?: readonly string[] }) {
  if (!text && !items?.length) {
    return null;
  }
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {text ? <Text style={styles.text}>{text}</Text> : null}
      {items?.map((item) => (
        <Text key={item} style={styles.text}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { listPersonalExercises } = useAuth();
  const activity: TrainingActivity | undefined = findTrainingActivity(id);
  const [personal, setPersonal] = useState<PersonalExercise | null | undefined>(activity ? null : undefined);

  // Un identifiant absent du catalogue est un exercice personnel de l'éducateur.
  useEffect(() => {
    if (activity) {
      return;
    }
    let cancelled = false;
    listPersonalExercises().then((list) => {
      if (!cancelled) {
        setPersonal(list.find((exercise) => exercise.id === id) ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activity, id, listPersonalExercises]);

  const exercise = activity ?? personal;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>← Bibliothèque</Text>
        </TouchableOpacity>
        {personal === undefined && <Text style={styles.muted}>Chargement…</Text>}
        {personal === null && !activity && <Text style={styles.error}>Cette situation est introuvable.</Text>}
        {exercise && (
          <>
            <Text style={styles.step}>{kindLabels[exercise.kind].toUpperCase()}</Text>
            <Text style={styles.title}>{exercise.title}</Text>
            {activity ? (
              <View style={styles.facts}>
                {[
                  ["Terrain", activity.fieldSize],
                  ["Défenseurs", String(activity.defenderCount)],
                  ["Gardien", activity.hasGoalkeeper ? "Oui" : "Non"],
                ].map(([label, value]) => (
                  <View key={label} style={styles.fact}>
                    <Text style={styles.factLabel}>{label}</Text>
                    <Text style={styles.factValue}>{value}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>Mon exercice · {personal?.theme}</Text>
            )}
            {activity && <TacticalPlayer exercise={activity} label={`Schéma tactique animé : ${activity.title}`} seed={activity.id} />}
            {personal?.photo ? <Image accessibilityLabel="Schéma de l’exercice" resizeMode="contain" source={{ uri: personal.photo }} style={styles.photo} /> : null}
            <Block text={exercise.objective} title="But" />
            <Block text={exercise.organization} title="Organisation" />
            <Block text={exercise.instruction} title="Consigne" />
            <Block items={activity?.rules} title="Règles" />
            <Block items={activity?.coachingPoints} title="Points de coaching" />
            <Block text={exercise.observable} title="Ce qu’on observe" />
            <Block items={activity?.equipment} title="Matériel" />
            {activity && <Text style={styles.muted}>Thèmes : {activity.compatibleThemes.join(", ")}</Text>}
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
  title: { fontSize: 26, fontWeight: "800", color: colors.ink, marginTop: 10, marginBottom: 12 },
  muted: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 4, marginBottom: 8 },
  error: { fontSize: 12, fontWeight: "700", color: colors.danger },
  facts: { flexDirection: "row", gap: 8, marginBottom: 12 },
  fact: { flex: 1, padding: 10, backgroundColor: colors.surface, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line },
  factLabel: { fontSize: 9, fontWeight: "800", color: colors.muted },
  factValue: { fontSize: 13, fontWeight: "800", color: colors.ink, marginTop: 4 },
  photo: { width: "100%", height: 220, borderRadius: radii.md, backgroundColor: colors.surface, marginBottom: 12 },
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 10 },
  cardTitle: { fontSize: 13, fontWeight: "800", color: colors.ink, marginBottom: 6 },
  text: { fontSize: 12, lineHeight: 18, color: colors.ink },
});
