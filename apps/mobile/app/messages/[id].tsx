import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { messageMaxLength, validateMessageText, type MessageAuthorRole } from "@evolyfoot/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../lib/auth-context";

interface ThreadMessage {
  id: string;
  authorRole: MessageAuthorRole;
  authorName: string;
  text: string;
  createdAt: string;
}

function formatTime(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Fil coach <-> joueur/tuteur, même API que la fiche joueur du web. Pas de temps réel : rechargé à
// l'ouverture, après envoi et en tirant la liste vers le bas.
export default function MessagesScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { apiRequest } = useAuth();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const url = `/api/roster/${encodeURIComponent(id)}/messages`;

  const fetchMessages = useCallback(async (): Promise<ThreadMessage[] | null> => {
    const response = await apiRequest(url);
    const body = response?.ok ? await response.json().catch(() => null) : null;
    return Array.isArray(body?.messages) ? body.messages : null;
  }, [apiRequest, url]);

  function apply(loaded: ThreadMessage[] | null) {
    if (loaded) {
      setMessages(loaded);
      setStatus("ready");
    } else {
      setStatus("error");
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchMessages().then((loaded) => {
      if (!cancelled) {
        apply(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchMessages]);

  async function refresh() {
    setRefreshing(true);
    apply(await fetchMessages());
    setRefreshing(false);
  }

  async function send() {
    const invalid = validateMessageText(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSending(true);
    setError("");
    const response = await apiRequest(url, { method: "POST", body: JSON.stringify({ text: draft }) });
    const body = await response?.json().catch(() => null);
    setSending(false);
    if (!response?.ok || !body?.message) {
      setError(typeof body?.error === "string" ? body.error : "Le message n’est pas parti, réessayez.");
      return;
    }
    setMessages((current) => [...current, body.message]);
    setDraft("");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.safe}>
        <View style={styles.top}>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>← Fiche</Text>
          </TouchableOpacity>
          <Text style={styles.step}>MESSAGES</Text>
          <Text style={styles.title}>{name ?? "Joueur"}</Text>
          <Text style={styles.muted}>Le joueur ou son tuteur lit et répond depuis EvolyFoot Player.</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          ref={scrollRef}
          refreshControl={<RefreshControl onRefresh={refresh} refreshing={refreshing} tintColor={colors.primary} />}
        >
          {status === "loading" && <Text style={styles.muted}>Chargement…</Text>}
          {status === "error" && <Text style={styles.error}>Impossible de charger les messages.</Text>}
          {status === "ready" && messages.length === 0 && <Text style={styles.muted}>Aucun message pour l’instant. Écrivez le premier.</Text>}
          {messages.map((message) => {
            const mine = message.authorRole === "coach";
            return (
              <View key={message.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                {!mine && <Text style={styles.author}>{message.authorName}</Text>}
                <Text style={[styles.text, mine && styles.textMine]}>{message.text}</Text>
                <Text style={[styles.time, mine && styles.timeMine]}>{formatTime(message.createdAt)}</Text>
              </View>
            );
          })}
        </ScrollView>
        <View style={styles.composer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TextInput
            accessibilityLabel="Votre message"
            maxLength={messageMaxLength}
            multiline
            onChangeText={setDraft}
            placeholder="Votre message"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={draft}
          />
          <TouchableOpacity
            accessibilityRole="button"
            disabled={sending || !draft.trim()}
            onPress={send}
            style={[styles.send, (sending || !draft.trim()) && styles.disabled]}
          >
            <Text style={styles.sendText}>{sending ? "Envoi…" : "Envoyer"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  top: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { fontSize: 12, fontWeight: "800", color: colors.primary, marginBottom: 14 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  title: { fontSize: 24, fontWeight: "800", color: colors.ink, marginTop: 4 },
  muted: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 6 },
  error: { fontSize: 12, fontWeight: "700", color: colors.danger, marginBottom: 6 },
  thread: { padding: spacing.lg, flexGrow: 1 },
  bubble: { maxWidth: "85%", padding: 12, marginBottom: spacing.sm, borderRadius: radii.sm },
  mine: { alignSelf: "flex-end", backgroundColor: colors.primary },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primaryDark },
  author: { color: colors.lime, fontSize: 11, fontWeight: "800", marginBottom: 2 },
  text: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  textMine: { color: colors.primaryInk, fontWeight: "600" },
  time: { fontSize: 10, color: colors.muted, marginTop: 4 },
  timeMine: { color: colors.primaryInk, opacity: 0.7 },
  composer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper },
  input: {
    minHeight: 56,
    maxHeight: 140,
    padding: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 15,
    textAlignVertical: "top",
  },
  send: { minHeight: 46, marginTop: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
  disabled: { opacity: 0.5 },
  sendText: { color: colors.primaryInk, fontSize: 14, fontWeight: "900" },
});
