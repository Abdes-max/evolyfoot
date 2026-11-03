import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { apiBaseUrl } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export default function ConnexionScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError("");
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.brand}>EVOLYFOOT PLAYER</Text>
        <Text style={styles.title}>Ta saison, ta carte, ton équipe.</Text>
        <Text style={styles.body}>Pour les joueurs et leurs parents. Ton compte se crée avec le lien envoyé par ton éducateur.</Text>

        <Text style={styles.label}>Adresse e-mail</Text>
        <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} style={styles.input} value={email} />
        <Text style={styles.label}>Mot de passe</Text>
        <TextInput autoComplete="current-password" onChangeText={setPassword} secureTextEntry style={styles.input} value={password} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity disabled={submitting} onPress={submit} style={styles.button}>
          <Text style={styles.buttonText}>{submitting ? "Connexion…" : "Se connecter"}</Text>
          <Text style={styles.buttonText}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL(`${apiBaseUrl()}/mot-de-passe-oublie`)} style={styles.linkButton}>
          <Text style={styles.linkText}>Mot de passe oublié ?</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingTop: 72 },
  brand: { color: colors.lime, fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  title: {
    color: colors.ink,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 12,
    textShadowColor: colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 12, marginBottom: 22 },
  label: { color: colors.ink, fontSize: 12, fontWeight: "800", marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm, padding: 14, color: colors.ink, fontSize: 16 },
  error: { color: colors.danger, fontSize: 13, marginTop: 16 },
  button: {
    marginTop: 28,
    padding: 16,
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  buttonText: { color: colors.primaryInk, fontSize: 14, fontWeight: "900" },
  linkButton: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 8 },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
});
