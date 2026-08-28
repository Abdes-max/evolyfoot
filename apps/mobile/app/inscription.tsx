import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { Link, router } from "expo-router";
import { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { useAuth } from "../lib/auth-context";

export default function InscriptionScreen() {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError("");
    setSubmitting(true);
    const result = await register(email, password, displayName);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace("/onboarding");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.step}>CRÉER UN COMPTE</Text>
        <Text style={styles.title}>Bienvenue sur EvolyFoot.</Text>
        <Text style={styles.body}>Un compte éducateur pour suivre la progression de ton équipe.</Text>

        <Text style={styles.label}>Nom</Text>
        <TextInput
          autoComplete="name"
          onChangeText={setDisplayName}
          placeholder="Ex. Abdes Meziane"
          style={styles.input}
          value={displayName}
        />
        <Text style={styles.label}>Adresse e-mail</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          style={styles.input}
          value={email}
        />
        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          autoComplete="new-password"
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          value={password}
        />
        <Text style={styles.hint}>Au moins 10 caractères.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity disabled={submitting} onPress={submit} style={styles.button}>
          <Text style={styles.buttonText}>{submitting ? "Création…" : "Créer mon compte"}</Text>
          <Text style={styles.buttonText}>→</Text>
        </TouchableOpacity>
        <Link asChild href="/connexion">
          <TouchableOpacity style={styles.linkButton}>
            <Text style={styles.linkText}>Déjà un compte ? Se connecter</Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingTop: 64 },
  step: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, color: colors.primary },
  title: { fontSize: 34, lineHeight: 39, fontWeight: "800", color: colors.ink, marginTop: 12 },
  body: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 10, marginBottom: 30 },
  label: { fontSize: 11, fontWeight: "800", color: colors.ink, marginBottom: 9, marginTop: 18 },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm, padding: 14, color: colors.ink },
  hint: { fontSize: 10, color: colors.muted, marginTop: 8 },
  error: { color: colors.danger, fontSize: 11, marginTop: 16 },
  button: {
    marginTop: 32,
    padding: 16,
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  buttonText: { color: colors.primaryInk, fontSize: 11, fontWeight: "800" },
  linkButton: { marginTop: 18, alignItems: "center" },
  linkText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
});
