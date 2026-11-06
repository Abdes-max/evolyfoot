import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router, useLocalSearchParams } from "expo-router";
import { concernedPlayers, convocationFeedback, type PlayerSelection } from "@evolyfoot/domain";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConcernedPlayersPicker, type ConcernedPlayer } from "../../components/concerned-players-picker";
import { PlaceInput } from "../../components/place-input";
import { TrainingResponses } from "../../components/training-responses";
import { useAuth } from "../../lib/auth-context";
import { competitionKinds, isCompetitionKind, isPastCompetition, type Competition } from "../../lib/competitions";
import { birthDateFromIso, birthDateToIso } from "../../lib/player-photo";

async function readError(response: Response | null): Promise<string> {
  const body = response ? await response.json().catch(() => ({})) : {};
  return typeof body.error === "string" ? body.error : "Une erreur est survenue.";
}

// Fiche d'un tournoi ou d'un plateau, comme competition-detail-view.tsx côté web : date, lieu,
// description, bilan et joueurs concernés modifiables, convocation et réponses, puis suppression.
export default function CompetitionDetailScreen() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind: string }>();
  const kind = isCompetitionKind(kindParam) ? kindParam : "tournament";
  const { endpoint, itemKey, singular } = competitionKinds[kind];
  const { apiRequest } = useAuth();
  const [item, setItem] = useState<Competition | null>(null);
  const [loadError, setLoadError] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [roster, setRoster] = useState<ConcernedPlayer[]>([]);
  const [selection, setSelection] = useState<PlayerSelection>(null);
  const [convoking, setConvoking] = useState(false);
  const [convocationStatus, setConvocationStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [response, rosterResponse] = await Promise.all([apiRequest(`${endpoint}/${id}`), apiRequest("/api/roster")]);
      if (cancelled) {
        return;
      }
      const rosterBody = rosterResponse?.ok ? await rosterResponse.json().catch(() => null) : null;
      setRoster(Array.isArray(rosterBody?.players) ? rosterBody.players : []);
      if (!response?.ok) {
        setLoadError(await readError(response));
        return;
      }
      const loaded: Competition | undefined = (await response.json().catch(() => null))?.[itemKey];
      if (cancelled || !loaded) {
        return;
      }
      setItem(loaded);
      setSelection(loaded.selectedPlayerIds ?? null);
      setDateInput(birthDateFromIso(loaded.date ? loaded.date.slice(0, 10) : null));
      setLocation(loaded.location ?? "");
      setDescription(loaded.description ?? "");
      setResult(loaded.result ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [apiRequest, endpoint, id, itemKey]);

  async function save() {
    const date = birthDateToIso(dateInput);
    if (date === undefined) {
      setSaveError("Date invalide : utilise le format JJ/MM/AAAA.");
      return;
    }
    setSaving(true);
    setSaveError("");
    setFeedback("");
    const response = await apiRequest(`${endpoint}/${id}/details`, {
      method: "PATCH",
      body: JSON.stringify({ date: date ? `${date}T00:00:00.000Z` : null, location, description, result, selectedPlayerIds: selection }),
    });
    setSaving(false);
    if (!response?.ok) {
      setSaveError(await readError(response));
      return;
    }
    const updated: Competition | undefined = (await response.json().catch(() => null))?.[itemKey];
    if (updated) {
      setItem(updated);
    }
    setFeedback("Détails enregistrés.");
  }

  // Convocation aux joueurs concernés (messagerie + e-mail) ; ouvre les réponses côté joueur.
  async function convoke() {
    setConvoking(true);
    setConvocationStatus("");
    const response = await apiRequest(`${endpoint}/${id}/convoke`, { method: "POST" });
    if (!response?.ok) {
      setConvoking(false);
      setConvocationStatus(await readError(response));
      return;
    }
    const body = await response.json().catch(() => null);
    setConvocationStatus(convocationFeedback(body?.sentCount ?? 0, body?.emailCount ?? 0));
    const refreshed = await apiRequest(`${endpoint}/${id}`);
    const refreshedItem: Competition | undefined = refreshed?.ok ? (await refreshed.json().catch(() => null))?.[itemKey] : undefined;
    if (refreshedItem) {
      setItem(refreshedItem);
    }
    setConvoking(false);
  }

  function confirmRemove() {
    Alert.alert(`Retirer ce ${singular} ?`, undefined, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Retirer",
        style: "destructive",
        onPress: async () => {
          const response = await apiRequest(`${endpoint}/${id}`, { method: "DELETE" });
          if (!response?.ok) {
            setSaveError(await readError(response));
            return;
          }
          router.back();
        },
      },
    ]);
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.page}>
          <Text style={styles.fieldError}>{loadError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return <SafeAreaView style={styles.safe} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.step}>{`${singular.toUpperCase()} ${isPastCompetition(item) ? "PASSÉ" : "À VENIR"}`}</Text>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.body}>{item.dateLabel}</Text>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Détails</Text>
          <Text style={styles.label}>Date</Text>
          <TextInput
            accessibilityLabel="Date"
            keyboardType="numbers-and-punctuation"
            onChangeText={setDateInput}
            placeholder="JJ/MM/AAAA"
            style={styles.input}
            value={dateInput}
          />
          <Text style={styles.label}>Lieu</Text>
          <PlaceInput onChange={setLocation} value={location} />
          <Text style={styles.label}>Description</Text>
          <TextInput accessibilityLabel="Description" multiline onChangeText={setDescription} style={[styles.input, styles.multiline]} value={description} />
          <Text style={styles.label}>Bilan</Text>
          <TextInput accessibilityLabel="Bilan" onChangeText={setResult} placeholder="Ex. 2 victoires, 1 nul" style={styles.input} value={result} />
          <View style={styles.picker}>
            <ConcernedPlayersPicker
              hint={`Seuls les joueurs cochés voient ce ${singular}, reçoivent la convocation et peuvent répondre.`}
              onChange={setSelection}
              roster={roster}
              value={selection}
            />
          </View>
          {saveError ? <Text style={styles.fieldError}>{saveError}</Text> : null}
          {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
          <TouchableOpacity accessibilityRole="button" disabled={saving || selection?.length === 0} onPress={save} style={styles.submitButton}>
            <Text style={styles.submitButtonText}>{saving ? "Enregistrement…" : "Enregistrer les détails"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Convocation</Text>
          <TrainingResponses
            attendance={item.attendance}
            convokedAt={item.convokedAt ?? null}
            roster={concernedPlayers(roster, item.selectedPlayerIds ?? null)}
            scheduledText={`Les joueurs concernés voient ce ${singular} sans pouvoir répondre tant que la convocation n’est pas envoyée.`}
          />
          {!isPastCompetition(item) && (
            <TouchableOpacity accessibilityRole="button" disabled={convoking} onPress={convoke} style={styles.submitButton}>
              <Text style={styles.submitButtonText}>{convoking ? "Envoi…" : item.convokedAt ? "Renvoyer la convocation" : "Envoyer la convocation"}</Text>
            </TouchableOpacity>
          )}
          {convocationStatus ? <Text style={styles.feedback}>{convocationStatus}</Text> : null}
        </View>

        <TouchableOpacity accessibilityRole="button" onPress={confirmRemove} style={styles.removeButton}>
          <Text style={styles.removeButtonText}>{`Retirer ce ${singular}`}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 50 },
  back: { color: colors.primary, fontSize: 12, fontWeight: "800", marginBottom: 16 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink, marginTop: 10 },
  body: { fontSize: 13, color: colors.muted, marginTop: 6 },
  form: { marginTop: 20, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface },
  formTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  label: { fontSize: 11, fontWeight: "800", color: colors.ink, marginTop: 14, marginBottom: 8 },
  input: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm, padding: 12, color: colors.ink },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  picker: { marginTop: 14 },
  fieldError: { color: colors.danger, fontSize: 10, marginTop: 10 },
  feedback: { color: colors.primary, fontSize: 11, fontWeight: "700", marginTop: 10 },
  submitButton: { minHeight: 44, marginTop: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: radii.sm },
  submitButtonText: { color: colors.primaryInk, fontSize: 12, fontWeight: "800" },
  removeButton: {
    minHeight: 44,
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.sm,
  },
  removeButtonText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
});
