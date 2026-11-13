import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { canValidateSession, concernedPlayers, convocationFeedback, type AttendanceEntry, type PlayerSelection, type TrainingSession } from "@evolyfoot/domain";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { themedStyles } from "../lib/themed-styles";
import { AttendanceValidation } from "./attendance-validation";
import { DateTimeField } from "./date-time-field";
import { PlaceInput } from "./place-input";
import { TrainingResponses } from "./training-responses";

export interface SavedSessionState {
  meetingAt: string | null;
  location: string | null;
  description: string | null;
  convokedAt: string | null;
  attendance: readonly AttendanceEntry[] | undefined;
}

// Rendez-vous, lieu, description, validation de la séance et convocation d'une séance déjà préparée,
// comme la fiche web (saved-session-view.tsx) : « Valider cette séance », « Détails », réponses des
// joueurs, envoi de la convocation et, une fois la séance passée, validation des présences.
export function SavedSessionDetails({
  sessionId,
  session,
  weekNumber,
  slot,
  guidedSeason,
  state,
  isPast,
  onChange,
}: {
  sessionId: string;
  session: TrainingSession;
  weekNumber: number;
  slot: number;
  // Séance de la saison guidée : se ré-enregistre dans son cycle réservé.
  guidedSeason: boolean;
  state: SavedSessionState;
  isPast: boolean;
  onChange: (patch: Partial<SavedSessionState>) => void;
}) {
  const { apiRequest, roster } = useAuth();
  const [meetingAt, setMeetingAt] = useState(state.meetingAt ?? new Date().toISOString());
  const [location, setLocation] = useState(state.location ?? "");
  const [description, setDescription] = useState(state.description ?? "");
  const [saving, setSaving] = useState(false);
  const [detailsStatus, setDetailsStatus] = useState("");
  const [validationStatus, setValidationStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [convoking, setConvoking] = useState(false);
  const [convocationStatus, setConvocationStatus] = useState("");
  const [playerIds, setPlayerIds] = useState<PlayerSelection>(null);
  const trainingRoster = concernedPlayers(roster, playerIds);
  const canValidate = canValidateSession(session);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await apiRequest("/api/team/convocations");
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (!cancelled) setPlayerIds(body?.settings?.playerIds ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [apiRequest]);

  async function saveDetails(): Promise<string | null> {
    const response = await apiRequest(`/api/sessions/${encodeURIComponent(sessionId)}/details`, {
      method: "PATCH",
      body: JSON.stringify({ meetingAt, location, description }),
    });
    const body = response ? await response.json().catch(() => null) : null;
    if (!response?.ok) {
      return typeof body?.error === "string" ? body.error : "L’enregistrement a échoué, réessaie.";
    }
    onChange({ meetingAt, location: location.trim() || null, description: description.trim() || null });
    return null;
  }

  async function submitDetails() {
    setSaving(true);
    setFailed(false);
    setDetailsStatus("");
    const error = await saveDetails();
    setSaving(false);
    setFailed(error !== null);
    setDetailsStatus(error ?? "Détails enregistrés.");
  }

  // Même appel que la validation web : la séance se ré-enregistre sur son créneau, avec le rendez-vous.
  async function validateSession() {
    setSaving(true);
    setFailed(false);
    setValidationStatus("");
    const response = await apiRequest("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        title: session.title,
        ageGroup: session.ageGroup,
        playerCount: session.playerCount,
        theme: session.theme,
        intention: session.intention,
        blocks: session.blocks.map((block) => ({ id: block.id, activityId: block.activity.id, durationMinutes: block.durationMinutes })),
        meetingAt,
        weekNumber,
        slot,
        ...(guidedSeason ? { guidedSeason: true } : {}),
      }),
    });
    const body = response ? await response.json().catch(() => null) : null;
    if (!response?.ok) {
      setSaving(false);
      setFailed(true);
      setValidationStatus(typeof body?.error === "string" ? body.error : "La séance n’a pas pu être enregistrée.");
      return;
    }
    const error = await saveDetails();
    setSaving(false);
    setFailed(error !== null);
    setValidationStatus(error ?? "Séance validée.");
  }

  async function sendConvocation() {
    setConvoking(true);
    setConvocationStatus("");
    const detailsError = await saveDetails();
    if (detailsError) {
      setConvoking(false);
      setConvocationStatus(detailsError);
      return;
    }
    const response = await apiRequest(`/api/sessions/${encodeURIComponent(sessionId)}/convoke`, { method: "POST" });
    const body = response ? await response.json().catch(() => null) : null;
    if (!response?.ok) {
      setConvoking(false);
      setConvocationStatus(typeof body?.error === "string" ? body.error : "La convocation n’est pas partie, réessaie.");
      return;
    }
    setConvocationStatus(convocationFeedback(body.sentCount, body.emailCount));
    // Relit la séance : date d'envoi et présences par défaut posées par le serveur.
    const refreshed = await apiRequest(`/api/sessions/${encodeURIComponent(sessionId)}`);
    const refreshedBody = refreshed?.ok ? await refreshed.json().catch(() => null) : null;
    onChange({ convokedAt: refreshedBody?.session?.convokedAt ?? new Date().toISOString(), attendance: refreshedBody?.session?.attendance });
    setConvoking(false);
  }

  function confirmConvocation() {
    if (location.trim()) {
      void sendConvocation();
      return;
    }
    Alert.alert("Aucun lieu renseigné", "La convocation partira sans lieu. Envoyer quand même ?", [
      { text: "Ajouter le lieu", style: "cancel" },
      { text: "Envoyer", onPress: () => void sendConvocation() },
    ]);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.label}>RENDEZ-VOUS</Text>
        <DateTimeField label="Rendez-vous" onChange={(value) => setMeetingAt(value.toISOString())} value={new Date(meetingAt)} />
      </View>

      {!canValidate ? <Text style={styles.warning}>La séance doit durer entre 60 et 90 minutes.</Text> : null}
      <TouchableOpacity
        accessibilityLabel="Valider cette séance"
        accessibilityRole="button"
        disabled={!canValidate || saving}
        onPress={() => void validateSession()}
        style={[styles.primary, (!canValidate || saving) && styles.disabled]}
      >
        <Text style={styles.primaryText}>{saving ? "Enregistrement…" : "Valider cette séance →"}</Text>
      </TouchableOpacity>
      {validationStatus ? <Text style={[styles.status, failed && styles.error]}>{validationStatus}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.title}>Détails</Text>
        <Text style={styles.hint}>Affichés sur la fiche que voit le joueur ou le tuteur.</Text>
        <Text style={styles.label}>LIEU</Text>
        <PlaceInput onChange={setLocation} value={location} />
        <Text style={styles.label}>DESCRIPTION</Text>
        <TextInput
          accessibilityLabel="Description"
          multiline
          onChangeText={setDescription}
          placeholder="Ex. Prévoir des protège-tibias et une gourde."
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={description}
        />
        <TouchableOpacity
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void submitDetails()}
          style={[styles.secondary, saving && styles.disabled]}
        >
          <Text style={styles.secondaryText}>{saving ? "Enregistrement…" : "Enregistrer les détails"}</Text>
        </TouchableOpacity>
        {detailsStatus ? <Text style={[styles.status, failed && styles.error]}>{detailsStatus}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Convocation</Text>
        <TrainingResponses attendance={state.attendance} convokedAt={state.convokedAt} roster={trainingRoster} />
        <TouchableOpacity accessibilityRole="button" disabled={convoking} onPress={confirmConvocation} style={[styles.primary, convoking && styles.disabled]}>
          <Text style={styles.primaryText}>{convoking ? "Envoi…" : state.convokedAt ? "Renvoyer la convocation" : "Envoyer la convocation maintenant"}</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>Envoyée à tout l’effectif dans la messagerie, avec le rendez-vous et le lieu.</Text>
        {convocationStatus ? <Text style={styles.status}>{convocationStatus}</Text> : null}
      </View>

      {isPast ? (
        <AttendanceValidation
          attendance={state.attendance}
          onSaved={(body) => onChange({ attendance: (body.session as { attendance?: readonly AttendanceEntry[] } | undefined)?.attendance })}
          players={trainingRoster}
          url={`/api/sessions/${encodeURIComponent(sessionId)}/attendance`}
        />
      ) : null}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    wrap: { gap: 6 },
    card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 12, gap: 8 },
    title: { fontSize: 16, fontWeight: "800", color: colors.ink },
    label: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 0.6 },
    hint: { fontSize: 11, lineHeight: 16, color: colors.muted },
    warning: { fontSize: 12, lineHeight: 18, color: colors.danger },
    primary: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary, paddingHorizontal: 12 },
    primaryText: { fontSize: 14, fontWeight: "800", color: colors.primaryInk },
    secondary: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.primary },
    secondaryText: { fontSize: 13, fontWeight: "800", color: colors.primary },
    disabled: { opacity: 0.5 },
    input: { minHeight: 84, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, padding: 10, color: colors.ink, textAlignVertical: "top" },
    status: { fontSize: 12, fontWeight: "800", color: colors.primary, textAlign: "center" },
    error: { color: colors.danger },
  }),
);
