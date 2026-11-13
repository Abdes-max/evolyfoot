import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { concernedPlayers, convocationFeedback, playersWithoutResponse, type AttendanceEntry, type PlayerSelection } from "@evolyfoot/domain";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { AttendanceValidation } from "./attendance-validation";
import { TrainingResponses } from "./training-responses";
import { themedStyles } from "../lib/themed-styles";

// Réponses à la convocation d'un match, d'un tournoi ou d'un plateau, et son envoi : une première fois à tous les
// joueurs concernés, puis en relance, à tous ou aux seuls joueurs qui n'ont pas encore répondu.
export function ConvocationActions({
  convokeUrl,
  convokedAt,
  attendance,
  selectedPlayerIds,
  roster,
  scheduledText,
  canSend,
  onSent,
  validateUrl,
  onAttendanceSaved,
}: {
  convokeUrl: string;
  convokedAt: string | null;
  attendance: readonly AttendanceEntry[] | undefined;
  selectedPlayerIds: PlayerSelection | undefined;
  roster: readonly { id: string; name: string; photo?: string | null }[];
  scheduledText: string;
  // Faux pour un événement passé : plus de convocation à envoyer.
  canSend: boolean;
  // Appelée après un envoi réussi : l'écran relit l'événement pour afficher la date d'envoi et les réponses.
  onSent: () => void | Promise<void>;
  // Événement terminé : `PUT .../attendance` pour valider ou corriger les présences (présent, en
  // retard, absent). Absent tant que l'événement n'est pas terminé ou s'il est annulé.
  validateUrl?: string;
  onAttendanceSaved?: (body: Record<string, unknown>) => void;
}) {
  const { apiRequest } = useAuth();
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const concerned = concernedPlayers(roster, selectedPlayerIds ?? null);
  const pendingCount = playersWithoutResponse(concerned, attendance).length;

  async function send(onlyPending: boolean) {
    setSending(true);
    setStatus("");
    setFailed(false);
    const response = await apiRequest(convokeUrl, { method: "POST", body: JSON.stringify({ onlyPending }) });
    const body = response ? await response.json().catch(() => null) : null;
    if (!response?.ok) {
      setFailed(true);
      setStatus(typeof body?.error === "string" ? body.error : "L’envoi a échoué, réessaie.");
      setSending(false);
      return;
    }
    setStatus(convocationFeedback(body?.sentCount ?? 0, body?.emailCount ?? 0));
    await onSent();
    setSending(false);
  }

  return (
    <View style={styles.wrap}>
      <TrainingResponses attendance={attendance} convokedAt={convokedAt} roster={concerned} scheduledText={scheduledText} />
      {canSend ? (
        convokedAt ? (
          <View style={styles.actions}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={sending || pendingCount === 0}
              onPress={() => void send(true)}
              style={[styles.primary, (sending || pendingCount === 0) && styles.disabled]}
            >
              <Text style={styles.primaryText}>
                {sending ? "Envoi…" : pendingCount === 0 ? "Tout le monde a répondu" : `Renvoyer aux sans réponse (${pendingCount})`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={sending}
              onPress={() => void send(false)}
              style={[styles.secondary, sending && styles.disabled]}
            >
              <Text style={styles.secondaryText}>Renvoyer à tous</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity accessibilityRole="button" disabled={sending} onPress={() => void send(false)} style={[styles.primary, sending && styles.disabled]}>
            <Text style={styles.primaryText}>{sending ? "Envoi…" : "Envoyer la convocation"}</Text>
          </TouchableOpacity>
        )
      ) : null}
      {status ? <Text style={failed ? styles.error : styles.feedback}>{status}</Text> : null}
      {validateUrl ? (
        <AttendanceValidation attendance={attendance} onSaved={(body) => onAttendanceSaved?.(body)} players={concerned} url={validateUrl} />
      ) : null}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    wrap: { gap: spacing.sm },
    actions: { gap: spacing.sm },
    primary: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary, paddingHorizontal: 12 },
    primaryText: { color: colors.primaryInk, fontSize: 13, fontWeight: "800" },
    secondary: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.primary },
    secondaryText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
    disabled: { opacity: 0.5 },
    feedback: { color: colors.primary, fontSize: 12, fontWeight: "700" },
    error: { color: colors.danger, fontSize: 12, fontWeight: "700" },
  }),
);
