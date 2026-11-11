import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { themedStyles } from "../lib/themed-styles";

// Annuler un match, un tournoi ou un plateau : message facultatif aux joueurs concernés, puis « Rétablir » pour revenir
// en arrière (sans nouveau message). `url` : `POST` annule, `DELETE` rétablit.
export function CancelEventPanel({
  url,
  noun,
  cancelledAt,
  cancellationNote,
  onChange,
}: {
  url: string;
  // « le match », « ce tournoi »… : sert au libellé du bouton.
  noun: string;
  cancelledAt: string | null | undefined;
  cancellationNote: string | null | undefined;
  onChange: (state: { cancelledAt: string | null; cancellationNote: string | null }) => void;
}) {
  const { apiRequest } = useAuth();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function cancel() {
    setBusy(true);
    setFeedback("");
    const response = await apiRequest(url, { method: "POST", body: JSON.stringify({ note }) });
    const body = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setFeedback(typeof body?.error === "string" ? body.error : "L’annulation a échoué, réessaie.");
      return;
    }
    onChange({ cancelledAt: new Date().toISOString(), cancellationNote: note.trim() || null });
    setOpen(false);
    setFeedback(
      body.sentCount > 0
        ? `Annulé : ${body.sentCount} joueur${body.sentCount > 1 ? "s" : ""} prévenu${body.sentCount > 1 ? "s" : ""}.`
        : "Annulé. Aucun message envoyé : la convocation n’était pas partie.",
    );
  }

  async function restore() {
    setBusy(true);
    setFeedback("");
    const response = await apiRequest(url, { method: "DELETE" });
    setBusy(false);
    if (!response?.ok) {
      setFeedback("Le rétablissement a échoué, réessaie.");
      return;
    }
    onChange({ cancelledAt: null, cancellationNote: null });
    setNote("");
    setFeedback("Rétabli. Renvoie la convocation pour en informer les joueurs.");
  }

  return (
    <View style={styles.box}>
      {cancelledAt ? (
        <>
          <Text accessibilityLiveRegion="polite" style={styles.state}>
            {`Annulé${cancellationNote ? ` : ${cancellationNote}` : ""}.`}
          </Text>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void restore()} style={styles.button}>
            <Text style={styles.buttonText}>{busy ? "…" : "Rétablir"}</Text>
          </TouchableOpacity>
        </>
      ) : open ? (
        <>
          <Text style={styles.label}>MESSAGE AUX JOUEURS (FACULTATIF)</Text>
          <TextInput
            accessibilityLabel="Message aux joueurs"
            maxLength={300}
            multiline
            onChangeText={setNote}
            placeholder="Ex. Terrain impraticable, on vous tient au courant."
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={note}
          />
          <Text style={styles.hint}>Les joueurs concernés reçoivent un message d’annulation.</Text>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void cancel()} style={[styles.button, styles.confirm]}>
            <Text style={styles.confirmText}>{busy ? "Annulation…" : "Confirmer l’annulation"}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => setOpen(false)} style={styles.button}>
            <Text style={styles.buttonText}>Garder</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(true)} style={styles.button}>
          <Text style={styles.buttonText}>{`Annuler ${noun}`}</Text>
        </TouchableOpacity>
      )}
      {feedback ? (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {feedback}
        </Text>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    box: { gap: 8, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line },
    state: { color: colors.danger, fontSize: 13, fontWeight: "800" },
    label: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
    hint: { color: colors.muted, fontSize: 12 },
    input: {
      minHeight: 70,
      textAlignVertical: "top",
      padding: 12,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      color: colors.ink,
    },
    button: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.line,
    },
    buttonText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
    confirm: { borderColor: colors.danger, backgroundColor: colors.danger },
    confirmText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  }),
);
