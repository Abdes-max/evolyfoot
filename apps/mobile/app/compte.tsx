import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router } from "expo-router";
import { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { useAuth } from "../lib/auth-context";

export default function AccountScreen() {
  const { deleteAccount, educator } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function confirm() {
    setDeleting(true);
    setError("");
    const result = await deleteAccount(password);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.title}>Supprimer mon compte</Text>
        <Text style={styles.body}>
          {educator?.role === "assistant"
            ? "Cette action est définitive : ton accès sera supprimé. L’équipe reste chez l’éducateur."
            : "Cette action est définitive : ton équipe, tes joueurs, tes séances, tes matchs, tes adjoints et les comptes tuteur liés seront supprimés."}
        </Text>
        <Text style={styles.label}>Confirme avec ton mot de passe</Text>
        <TextInput autoComplete="current-password" onChangeText={setPassword} secureTextEntry style={styles.input} value={password} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          accessibilityRole="button"
          disabled={deleting || !password}
          onPress={confirm}
          style={[styles.delete, (deleting || !password) && styles.disabled]}
        >
          <Text style={styles.deleteText}>{deleting ? "Suppression…" : "Supprimer définitivement"}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} style={styles.cancel}>
          <Text style={styles.cancelText}>Annuler</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingTop: 64 },
  title: { fontSize: 30, fontWeight: "800", color: colors.ink },
  body: { fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 10, marginBottom: 18 },
  label: { fontSize: 12, fontWeight: "800", color: colors.ink, marginBottom: 8 },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm, padding: 14, color: colors.ink },
  error: { color: colors.danger, fontSize: 13, marginTop: 12 },
  delete: { minHeight: 48, marginTop: 24, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.danger },
  disabled: { opacity: 0.5 },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: "800" },
  cancel: { minHeight: 44, marginTop: 8, alignItems: "center", justifyContent: "center" },
  cancelText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
});
