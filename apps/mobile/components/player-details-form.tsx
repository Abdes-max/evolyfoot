import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { playerFeet, playerPositions } from "@evolyfoot/domain";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type KeyboardTypeOptions } from "react-native";
import type { ReportPlayer } from "../lib/pdf-export";
import { birthDateFromIso, birthDateToIso } from "../lib/player-photo";

type FieldKey = "firstName" | "lastName" | "birthDate" | "jerseyNumber" | "phone" | "email" | "strengths" | "workAreas";
type Form = Record<FieldKey | "position" | "preferredFoot", string>;

const fields: { key: FieldKey; label: string; placeholder?: string; keyboard?: KeyboardTypeOptions; multiline?: boolean }[] = [
  { key: "firstName", label: "Prénom" },
  { key: "lastName", label: "Nom" },
  { key: "birthDate", label: "Date de naissance", placeholder: "JJ/MM/AAAA", keyboard: "numbers-and-punctuation" },
  { key: "jerseyNumber", label: "Numéro de maillot", keyboard: "number-pad" },
  { key: "phone", label: "Téléphone du joueur ou du tuteur", keyboard: "phone-pad" },
  { key: "email", label: "E-mail du joueur ou du tuteur", keyboard: "email-address" },
  { key: "strengths", label: "Points forts", multiline: true },
  { key: "workAreas", label: "Axes de travail", multiline: true },
];

const choices: { key: "position" | "preferredFoot"; label: string; options: readonly string[] }[] = [
  { key: "position", label: "Poste", options: playerPositions },
  { key: "preferredFoot", label: "Pied fort", options: playerFeet },
];

export function PlayerDetailsForm({
  player,
  onCancel,
  onSave,
}: {
  player: ReportPlayer;
  onCancel: () => void;
  // Renvoie un message d'erreur, ou `null` si l'enregistrement a réussi.
  onSave: (patch: Record<string, string | null>) => Promise<string | null>;
}) {
  const [form, setForm] = useState<Form>({
    firstName: player.firstName,
    lastName: player.lastName,
    birthDate: birthDateFromIso(player.birthDate),
    jerseyNumber: player.jerseyNumber ?? "",
    phone: player.phone ?? "",
    email: player.email ?? "",
    strengths: player.strengths ?? "",
    workAreas: player.workAreas ?? "",
    position: player.position ?? "",
    preferredFoot: player.preferredFoot ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Le prénom et le nom ne peuvent pas être vides.");
      return;
    }
    const birthDate = birthDateToIso(form.birthDate);
    if (birthDate === undefined) {
      setError("La date de naissance doit être au format JJ/MM/AAAA.");
      return;
    }
    setSaving(true);
    setError("");
    const failure = await onSave({
      firstName: form.firstName,
      lastName: form.lastName,
      birthDate,
      phone: form.phone || null,
      email: form.email || null,
      position: form.position || null,
      jerseyNumber: form.jerseyNumber || null,
      preferredFoot: form.preferredFoot || null,
      strengths: form.strengths || null,
      workAreas: form.workAreas || null,
    });
    setSaving(false);
    if (failure) {
      setError(failure);
    }
  }

  return (
    <View>
      {fields.slice(0, 2).map(renderField)}
      {choices.map((choice) => (
        <View key={choice.key} style={styles.field}>
          <Text style={styles.label}>{choice.label}</Text>
          <View style={styles.chips}>
            {choice.options.map((option) => {
              const selected = form[choice.key] === option;
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={option}
                  // Un second appui sur le choix actif l'efface.
                  onPress={() => setForm({ ...form, [choice.key]: selected ? "" : option })}
                  style={[styles.chip, selected && styles.chipActive]}
                >
                  <Text style={styles.chipText}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
      {fields.slice(2).map(renderField)}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={save} style={[styles.primary, saving && styles.disabled]}>
        <Text style={styles.primaryText}>{saving ? "Enregistrement…" : "Enregistrer la fiche"}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={onCancel} style={styles.ghost}>
        <Text style={styles.link}>Annuler</Text>
      </TouchableOpacity>
    </View>
  );

  function renderField(field: (typeof fields)[number]) {
    return (
      <View key={field.key} style={styles.field}>
        <Text style={styles.label}>{field.label}</Text>
        <TextInput
          autoCapitalize={field.key === "email" ? "none" : "sentences"}
          keyboardType={field.keyboard}
          multiline={field.multiline}
          onChangeText={(value) => setForm({ ...form, [field.key]: value })}
          placeholder={field.placeholder}
          placeholderTextColor={colors.muted}
          style={[styles.input, field.multiline && styles.multiline]}
          value={form[field.key]}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  field: { marginTop: spacing.sm },
  label: { fontSize: 10, fontWeight: "800", color: colors.muted, marginBottom: 4 },
  input: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm, padding: 12, color: colors.ink },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 11, fontWeight: "700", color: colors.ink },
  error: { fontSize: 12, fontWeight: "700", color: colors.danger, marginTop: 8 },
  primary: { minHeight: 46, marginTop: 12, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
  primaryText: { color: colors.primaryInk, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  ghost: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  link: { fontSize: 13, fontWeight: "800", color: colors.primary },
});
