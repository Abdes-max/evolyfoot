import {
  ageGroups,
  createTeamProfile,
  gameFormats,
  validateTeamProfile,
  type TeamProfile,
  type TrainingDay,
} from "@evolyfoot/domain";
import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router } from "expo-router";
import { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";

const days: TrainingDay[] = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const initialProfile: TeamProfile = { name: "", ageGroup: "U12", gameFormat: 8, playerCount: 14, sessionsPerWeek: 2, trainingDays: [] };

export default function OnboardingScreen() {
  const { team, saveTeam } = useAuth();
  // L'équipe déjà enregistrée (si l'éducateur en a une) est résolue avant que ce champ ne
  // soit atteignable — voir AuthContext.login/register — donc un état paresseux suffit,
  // sans effet ni cascade de rendus pour la préremplir.
  const [profile, setProfile] = useState<TeamProfile>(() => team ?? initialProfile);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const errors = submitted ? validateTeamProfile(profile) : {};
  const toggleDay = (day: TrainingDay) =>
    setProfile((current) => ({
      ...current,
      trainingDays: current.trainingDays.includes(day)
        ? current.trainingDays.filter((item) => item !== day)
        : [...current.trainingDays, day],
    }));

  async function submit() {
    setSubmitted(true);
    setSaveError("");
    if (Object.keys(validateTeamProfile(profile)).length) {
      return;
    }
    setSaving(true);
    const result = await saveTeam(createTeamProfile(profile));
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    router.push("/diagnostic");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.step}>ÉTAPE 1 SUR 3</Text>
        <Text style={styles.title}>Commençons par ton équipe.</Text>
        <Text style={styles.body}>Ces repères permettent d’adapter le plan de progression à ta réalité terrain.</Text>

        <Text style={styles.label}>Nom de l’équipe</Text>
        <TextInput
          onChangeText={(name) => setProfile({ ...profile, name })}
          placeholder="Ex. FC Horizon"
          style={styles.input}
          value={profile.name}
        />
        {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}

        <Text style={styles.label}>Catégorie</Text>
        <View style={styles.choices}>
          {ageGroups.map((group) => (
            <TouchableOpacity
              key={group}
              onPress={() => setProfile({ ...profile, ageGroup: group })}
              style={[styles.choice, profile.ageGroup === group && styles.active]}
            >
              <Text style={[styles.choiceText, profile.ageGroup === group && styles.activeText]}>{group}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Format de jeu</Text>
        <View style={styles.formatGrid}>
          {gameFormats.map((format) => (
            <TouchableOpacity
              key={format}
              onPress={() => setProfile({ ...profile, gameFormat: format })}
              style={[styles.formatChoice, profile.gameFormat === format && styles.active]}
            >
              <Text style={[styles.choiceText, profile.gameFormat === format && styles.activeText]}>
                Foot à {format}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.gameFormat ? <Text style={styles.fieldError}>{errors.gameFormat}</Text> : null}

        <Text style={styles.label}>Nombre de joueurs</Text>
        <TextInput
          keyboardType="number-pad"
          onChangeText={(value) => setProfile({ ...profile, playerCount: Number(value) || 0 })}
          style={styles.input}
          value={String(profile.playerCount)}
        />
        {errors.playerCount ? <Text style={styles.fieldError}>{errors.playerCount}</Text> : null}

        <Text style={styles.label}>Séances par semaine</Text>
        <View style={styles.choices}>
          {[1, 2, 3, 4].map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => setProfile({ ...profile, sessionsPerWeek: value })}
              style={[styles.choice, profile.sessionsPerWeek === value && styles.active]}
            >
              <Text style={[styles.choiceText, profile.sessionsPerWeek === value && styles.activeText]}>{value}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Jours d’entraînement</Text>
        <Text style={styles.hint}>
          Sélectionne {profile.sessionsPerWeek} jour{profile.sessionsPerWeek > 1 ? "s" : ""}.
        </Text>
        <View style={styles.dayGrid}>
          {days.map((day) => (
            <TouchableOpacity
              key={day}
              onPress={() => toggleDay(day)}
              style={[styles.day, profile.trainingDays.includes(day) && styles.active]}
            >
              <Text style={[styles.choiceText, profile.trainingDays.includes(day) && styles.activeText]}>
                {day.slice(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.trainingDays ? <Text style={styles.fieldError}>{errors.trainingDays}</Text> : null}

        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

        <TouchableOpacity disabled={saving} onPress={submit} style={styles.button}>
          <Text style={styles.buttonText}>{saving ? "Enregistrement…" : "Valider mon équipe"}</Text>
          <Text style={styles.buttonText}>→</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingTop: 48, paddingBottom: 60 },
  step: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, color: colors.primary },
  title: { fontSize: 34, lineHeight: 39, fontWeight: "800", color: colors.ink, marginTop: 12 },
  body: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 10, marginBottom: 30 },
  label: { fontSize: 11, fontWeight: "800", color: colors.ink, marginBottom: 9, marginTop: 20 },
  hint: { fontSize: 10, color: colors.muted, marginBottom: 10 },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm, padding: 14, color: colors.ink },
  fieldError: { color: colors.danger, fontSize: 10, marginTop: 6 },
  error: { color: colors.danger, fontSize: 11, marginTop: 20 },
  choices: { flexDirection: "row", gap: 8 },
  choice: { flex: 1, alignItems: "center", padding: 14, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm },
  formatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  formatChoice: { width: "22%", alignItems: "center", padding: 12, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm },
  dayGrid: { flexDirection: "row", gap: 6 },
  day: { flex: 1, alignItems: "center", padding: 11, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm },
  active: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  choiceText: { fontSize: 11, fontWeight: "800", color: colors.muted },
  activeText: { color: colors.primary },
  button: {
    marginTop: 40,
    padding: 16,
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  buttonText: { color: colors.primaryInk, fontSize: 11, fontWeight: "800" },
});
