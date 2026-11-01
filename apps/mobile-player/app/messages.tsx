import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Screen } from "../components/screen";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth-context";

interface Message {
  id: string;
  authorRole: "coach" | "player";
  authorName: string;
  text: string;
  createdAt: string;
}

export default function MessagesScreen() {
  const { sessionToken } = useAuth();
  const [messages, setMessages] = useState<readonly Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const response = await apiFetch("/api/joueur/messages", { sessionToken }).catch(() => null);
        const body = await response?.json().catch(() => null);
        if (!cancelled) {
          if (response?.ok) {
            setMessages(body?.messages ?? []);
            setError("");
          } else {
            setError("Impossible de charger les messages.");
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [sessionToken]),
  );

  async function send() {
    const text = draft.trim();
    if (!text) {
      return;
    }
    setSending(true);
    setError("");
    const response = await apiFetch("/api/joueur/messages", {
      method: "POST",
      sessionToken,
      body: JSON.stringify({ text }),
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setSending(false);
    if (!response?.ok || !body?.message) {
      setError("Le message n’est pas parti, réessaie.");
      return;
    }
    setMessages((current) => [...current, body.message]);
    setDraft("");
  }

  return (
    <Screen title="Messages">
      {messages.length === 0 && !error ? <Text style={styles.note}>Écris ici à ton éducateur.</Text> : null}
      {messages.map((message) => {
        const mine = message.authorRole === "player";
        return (
          <View key={message.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
            {!mine ? <Text style={styles.author}>{message.authorName}</Text> : null}
            <Text style={[styles.text, mine && styles.textMine]}>{message.text}</Text>
          </View>
        );
      })}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        accessibilityLabel="Ton message"
        multiline
        onChangeText={setDraft}
        placeholder="Ton message"
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={draft}
      />
      <TouchableOpacity accessibilityRole="button" disabled={sending || !draft.trim()} onPress={send} style={[styles.send, (sending || !draft.trim()) && styles.sendDisabled]}>
        <Text style={styles.sendText}>{sending ? "Envoi…" : "Envoyer"}</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.muted, fontSize: 14, marginBottom: spacing.md },
  bubble: { maxWidth: "85%", padding: 12, marginBottom: spacing.sm, borderRadius: radii.sm },
  mine: { alignSelf: "flex-end", backgroundColor: colors.primary },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primaryDark },
  author: { color: colors.lime, fontSize: 11, fontWeight: "800", marginBottom: 2 },
  text: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  textMine: { color: colors.primaryInk, fontWeight: "600" },
  error: { color: colors.danger, fontSize: 13, marginVertical: spacing.sm },
  input: { minHeight: 76, marginTop: spacing.md, padding: 12, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink, fontSize: 15, textAlignVertical: "top" },
  send: { minHeight: 46, marginTop: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: colors.primaryInk, fontSize: 14, fontWeight: "900" },
});
