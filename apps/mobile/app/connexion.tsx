import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { Link, router } from "expo-router";
import { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
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
        <Text style={styles.step}>ESPACE ÉDUCATEUR</Text>
        <Text style={styles.title}>Content de te revoir.</Text>
        <Text style={styles.body}>Connecte-toi avec l’adresse e-mail de ton compte éducateur.</Text>

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
          autoComplete="current-password"
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          value={password}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity disabled={submitting} onPress={submit} style={styles.button}>
          <Text style={styles.buttonText}>{submitting ? "Connexion…" : "Se connecter"}</Text>
          <Text style={styles.buttonText}>→</Text>
        </TouchableOpacity>
        <Link asChild href="/inscription">
          <TouchableOpacity style={styles.linkButton}>
            <Text style={styles.linkText}>Pas encore de compte ? Créer un compte</Text>
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
