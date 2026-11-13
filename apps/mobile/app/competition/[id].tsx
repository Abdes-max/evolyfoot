import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router, useLocalSearchParams } from "expo-router";
import { competitionRecordLabel, concernedPlayers, type CompetitionLineup, type GameFormat, type PlayerSelection } from "@evolyfoot/domain";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConcernedPlayersPicker, type ConcernedPlayer } from "../../components/concerned-players-picker";
import { PlaceInput } from "../../components/place-input";
import { CancelEventPanel, CancelledBanner } from "../../components/cancel-event-panel";
import { CollapsibleSection } from "../../components/collapsible-section";
import { CompetitionGames } from "../../components/competition-games";
import { CompetitionLineupEditor } from "../../components/competition-lineup";
import { ConvocationActions } from "../../components/convocation-actions";
import { useAuth } from "../../lib/auth-context";
import { selectionSummary } from "../../lib/selection-summary";
import { competitionKinds, isCompetitionKind, isPastCompetition, type Competition } from "../../lib/competitions";
import { birthDateFromIso, birthDateToIso } from "../../lib/player-photo";
import { themedStyles } from "../../lib/themed-styles";

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
  const { apiRequest, team, roster: teamRoster } = useAuth();
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
  const [selectionFeedback, setSelectionFeedback] = useState("");
  // Remonte l'éditeur de compo quand le serveur l'a restreinte aux joueurs concernés.
  const [lineupVersion, setLineupVersion] = useState(0);
  const [teamLineup, setTeamLineup] = useState<CompetitionLineup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [response, rosterResponse, teamLineupResponse] = await Promise.all([
        apiRequest(`${endpoint}/${id}`),
        apiRequest("/api/roster"),
        apiRequest("/api/team/lineup"),
      ]);
      if (cancelled) {
        return;
      }
      const rosterBody = rosterResponse?.ok ? await rosterResponse.json().catch(() => null) : null;
      const teamLineupBody = teamLineupResponse?.ok ? await teamLineupResponse.json().catch(() => null) : null;
      setTeamLineup(teamLineupBody?.lineup ?? null);
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
      body: JSON.stringify({ date: date ? `${date}T00:00:00.000Z` : null, location, description, result }),
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

  // Joueurs concernés : même section que la fiche match. La compo et les rencontres suivent la sélection
  // enregistrée (un joueur décoché quitte la composition).
  async function saveSelection() {
    setSelectionFeedback("");
    const response = await apiRequest(`${endpoint}/${id}/details`, { method: "PATCH", body: JSON.stringify({ selectedPlayerIds: selection }) });
    const updated: Competition | undefined = response?.ok ? (await response.json().catch(() => null))?.[itemKey] : undefined;
    if (!updated) {
      setSelectionFeedback("Les joueurs concernés n’ont pas été enregistrés, réessaie.");
      return;
    }
    setItem(updated);
    setSelection(updated.selectedPlayerIds ?? null);
    setLineupVersion((version) => version + 1);
    setSelectionFeedback("Joueurs concernés enregistrés.");
  }

  // Marque la fiche comme terminée, ou la rouvre : un tournoi terminé passe dans « Passés » même avant sa date.
  async function toggleFinished() {
    if (!item) {
      return;
    }
    setSaving(true);
    setSaveError("");
    setFeedback("");
    const response = await apiRequest(`${endpoint}/${id}/details`, { method: "PATCH", body: JSON.stringify({ finished: !item.finishedAt }) });
    setSaving(false);
    if (!response?.ok) {
      setSaveError(await readError(response));
      return;
    }
    const updated: Competition | undefined = (await response.json().catch(() => null))?.[itemKey];
    if (updated) {
      setItem(updated);
    }
  }

  // Relit la fiche après l'envoi d'une convocation : date d'envoi et réponses.
  async function refresh() {
    const refreshed = await apiRequest(`${endpoint}/${id}`);
    const refreshedItem: Competition | undefined = refreshed?.ok ? (await refreshed.json().catch(() => null))?.[itemKey] : undefined;
    if (refreshedItem) {
      setItem(refreshedItem);
    }
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
        <Text
          style={styles.step}
        >{`${singular.toUpperCase()}${item.cancelledAt ? "" : item.finishedAt ? " TERMINÉ" : isPastCompetition(item) ? " PASSÉ" : " À VENIR"}`}</Text>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.body}>{item.dateLabel}</Text>

        {item.cancelledAt ? <CancelledBanner note={item.cancellationNote} /> : null}

        {item.cancelledAt ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Détails</Text>
            <Text style={styles.label}>Lieu</Text>
            <Text style={styles.readonlyValue}>{item.location || "Lieu non renseigné"}</Text>
            {item.description ? (
              <>
                <Text style={styles.label}>Description</Text>
                <Text style={styles.readonlyValue}>{item.description}</Text>
              </>
            ) : null}
          </View>
        ) : (
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
            {saveError ? <Text style={styles.fieldError}>{saveError}</Text> : null}
            {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
            <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={save} style={styles.submitButton}>
              <Text style={styles.submitButtonText}>{saving ? "Enregistrement…" : "Enregistrer les détails"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.cancelledAt ? null : (
          <CollapsibleSection
            style={{ marginTop: spacing.md }}
            summary={selectionSummary(item.selectedPlayerIds ?? null, roster.length)}
            title="Joueurs concernés"
          >
            <ConcernedPlayersPicker
              hint={`Seuls les joueurs cochés voient ce ${singular}, reçoivent la convocation et entrent dans la composition et les rencontres.`}
              onChange={(value) => {
                setSelection(value);
                setSelectionFeedback("");
              }}
              roster={roster}
              value={selection}
            />
            {JSON.stringify(selection) !== JSON.stringify(item.selectedPlayerIds ?? null) ? (
              <TouchableOpacity accessibilityRole="button" disabled={selection?.length === 0} onPress={() => void saveSelection()} style={styles.submitButton}>
                <Text style={styles.submitButtonText}>Enregistrer les joueurs concernés</Text>
              </TouchableOpacity>
            ) : null}
            {selectionFeedback ? <Text style={styles.feedback}>{selectionFeedback}</Text> : null}
          </CollapsibleSection>
        )}

        <View style={styles.form}>
          <Text style={styles.formTitle}>{item.cancelledAt ? "Annulation" : "Convocation"}</Text>
          {/* Annulé : ni convocation, ni présents / absents. */}
          {item.cancelledAt ? null : (
            <ConvocationActions
              attendance={item.attendance}
              canSend={!isPastCompetition(item) && !item.cancelledAt}
              convokeUrl={`${endpoint}/${id}/convoke`}
              convokedAt={item.convokedAt ?? null}
              onSent={refresh}
              roster={roster}
              scheduledText={`Les joueurs concernés voient ce ${singular} sans pouvoir répondre tant que la convocation n’est pas envoyée.`}
              selectedPlayerIds={item.selectedPlayerIds}
            />
          )}
          <CancelEventPanel
            cancellationNote={item.cancellationNote}
            cancelledAt={item.cancelledAt}
            hideState
            noun={`ce ${singular}`}
            onChange={(state) => setItem((current) => (current ? { ...current, ...state } : current))}
            url={`${endpoint}/${id}/cancel`}
          />
        </View>

        {item.cancelledAt ? null : (
          <CollapsibleSection
            style={{ marginTop: spacing.md }}
            summary={item.lineup?.lineup.length ? `${item.lineup.lineup.length} titulaires · foot à ${item.lineup.gameFormat}` : "Facultative"}
            title="Composition"
          >
            <View style={{ marginTop: spacing.md }}>
              <CompetitionLineupEditor
                defaultGameFormat={(team?.gameFormat ?? 8) as GameFormat}
                initial={item.lineup ?? null}
                key={`${item.id}-${lineupVersion}`}
                lineupUrl={`${endpoint}/${id}/lineup`}
                players={teamRoster.filter(
                  (player) =>
                    concernedPlayers([player], item.selectedPlayerIds ?? null).length > 0 ||
                    item.lineup?.lineup.some((assignment) => assignment.playerId === player.id) ||
                    item.lineup?.substitutePlayerIds.includes(player.id),
                )}
                readOnly={Boolean(item.finishedAt || item.cancelledAt)}
                template={teamLineup}
              />
            </View>
          </CollapsibleSection>
        )}

        {item.cancelledAt ? null : (
          <CollapsibleSection
            style={{ marginTop: spacing.md }}
            summary={competitionRecordLabel(item.games ?? []) || "Aucune rencontre saisie"}
            title="Rencontres et scores"
          >
            <Text style={styles.gamesHint}>
              {item.cancelledAt
                ? `Ce ${singular} est annulé : rétablis-le pour saisir les rencontres.`
                : "Une ligne par rencontre jouée : équipe rencontrée, score, buteurs et passeurs décisifs."}
            </Text>
            {item.cancelledAt ? null : (
              <View style={{ marginTop: spacing.md }}>
                <CompetitionGames
                  gamesUrl={`${endpoint}/${id}/games`}
                  games={item.games ?? []}
                  key={item.id}
                  onSaved={(games) => setItem((current) => (current ? { ...current, games } : current))}
                  players={concernedPlayers(roster, item.selectedPlayerIds ?? null)}
                />
              </View>
            )}
          </CollapsibleSection>
        )}

        {item.cancelledAt ? null : (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={saving}
            onPress={() => void toggleFinished()}
            style={[styles.finishButton, saving && { opacity: 0.5 }]}
          >
            <Text style={styles.finishButtonText}>{item.finishedAt ? `Rouvrir ce ${singular}` : `Marquer ce ${singular} comme terminé`}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity accessibilityRole="button" onPress={confirmRemove} style={styles.removeButton}>
          <Text style={styles.removeButtonText}>{`Retirer ce ${singular}`}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
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
    finishButton: {
      minHeight: 46,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.sm,
      backgroundColor: colors.primary,
      marginTop: spacing.md,
    },
    finishButtonText: { color: colors.primaryInk, fontSize: 13, fontWeight: "900" },
    cancelledNote: {
      marginTop: spacing.md,
      padding: 12,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
      color: colors.danger,
      fontSize: 13,
      fontWeight: "700",
    },
    readonlyValue: { color: colors.ink, fontSize: 14 },
    gamesHint: { color: colors.muted, fontSize: 12.5, marginTop: 6 },
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
  }),
);
