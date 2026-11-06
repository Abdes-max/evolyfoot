import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { defaultTrainingTime, sortTrainingDays, type TrainingDay, type TrainingSlotSchedule } from "@evolyfoot/domain";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { PlaceInput } from "./place-input";

// Une ligne par jour d'entraînement : heure (HH:MM) et lieu repris par toutes les séances de ce jour
// (même écran que le web, training-schedule-editor.tsx).
export function TrainingScheduleFields({
  trainingDays,
  value,
  onChange,
}: {
  trainingDays: readonly TrainingDay[];
  value: readonly TrainingSlotSchedule[];
  onChange: (value: TrainingSlotSchedule[]) => void;
}) {
  const days = sortTrainingDays(trainingDays);
  if (days.length === 0) {
    return <Text style={styles.muted}>Renseigne d’abord les jours d’entraînement de ton équipe.</Text>;
  }
  const entryFor = (day: TrainingDay) => value.find((entry) => entry.day === day) ?? { day, time: defaultTrainingTime, location: "" };
  const update = (day: TrainingDay, patch: Partial<TrainingSlotSchedule>) =>
    onChange(days.map((candidate) => (candidate === day ? { ...entryFor(candidate), ...patch } : entryFor(candidate))));

  return (
    <View style={styles.rows}>
      {days.map((day) => {
        const entry = entryFor(day);
        return (
          <View key={day} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={styles.day}>{day}</Text>
              <TextInput
                accessibilityLabel={`Heure du ${day.toLowerCase()}`}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                onChangeText={(time) => update(day, { time })}
                placeholder="18:00"
                placeholderTextColor={colors.muted}
                style={styles.time}
                value={entry.time}
              />
            </View>
            <PlaceInput onChange={(location) => update(day, { location })} value={entry.location} />
          </View>
        );
      })}
    </View>
  );
}

// Bloc « Mes créneaux » de la saison : seul endroit où l'heure et le lieu des séances se règlent ;
// les séances à venir déjà préparées suivent le nouveau réglage.
export function TrainingScheduleBlock({
  trainingDays,
  schedule,
  onSaved,
}: {
  trainingDays: readonly TrainingDay[];
  schedule: readonly TrainingSlotSchedule[];
  onSaved: (schedule: TrainingSlotSchedule[]) => void;
}) {
  const { apiRequest } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TrainingSlotSchedule[]>([...schedule]);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    const response = await apiRequest("/api/season-program/schedule", { method: "PUT", body: JSON.stringify({ schedule: draft }) });
    const body = await response?.json().catch(() => null);
    if (!response?.ok || !body?.program) {
      setError(body?.error ?? "Les créneaux n’ont pas été enregistrés.");
      return;
    }
    onSaved(body.program.schedule ?? []);
    setEditing(false);
  }

  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Text style={styles.title}>Mes créneaux</Text>
        {!editing ? (
          <TouchableOpacity
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              setDraft([...schedule]);
              setEditing(true);
            }}
          >
            <Text style={styles.link}>Modifier</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {editing ? (
        <>
          <TrainingScheduleFields onChange={setDraft} trainingDays={trainingDays} value={draft} />
          <Text style={styles.muted}>Les séances déjà préparées et à venir prendront ces horaires et ces lieux.</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void save()} style={styles.primary}>
            <Text style={styles.primaryText}>Enregistrer mes créneaux</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => setEditing(false)}>
            <Text style={styles.link}>Annuler</Text>
          </TouchableOpacity>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      ) : schedule.length === 0 ? (
        <Text style={styles.muted}>Aucun créneau défini : indique l’heure et le lieu de chaque jour d’entraînement.</Text>
      ) : (
        sortTrainingDays(schedule.map((entry) => entry.day)).map((day) => {
          const entry = schedule.find((candidate) => candidate.day === day)!;
          return (
            <Text key={day} style={styles.summary}>
              <Text style={styles.day}>{day}</Text> · {entry.time}
              {entry.location ? ` · ${entry.location}` : ""}
            </Text>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing.sm },
  row: { gap: 6, padding: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  day: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  time: {
    width: 84,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  block: {
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  blockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  summary: { color: colors.muted, fontSize: 13 },
  muted: { color: colors.muted, fontSize: 12.5 },
  link: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  primary: { alignItems: "center", paddingVertical: 12, borderRadius: radii.md, backgroundColor: colors.primary },
  primaryText: { color: colors.primaryInk, fontSize: 14, fontWeight: "900" },
  error: { color: colors.danger, fontSize: 12 },
});
