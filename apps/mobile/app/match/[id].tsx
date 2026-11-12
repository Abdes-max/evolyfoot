import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import {
  addSubstitute,
  assignPlayerToSlot,
  canFinalizeMatchPlan,
  validateMatchPlan,
  clearSlot,
  concernedPlayers,
  formationSlots,
  listFormations,
  maxSubstitutes,
  removeSubstitute,
} from "@evolyfoot/domain";
import type { GameFormat, MatchPlan, MatchVenue, PlayerSelection } from "@evolyfoot/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CollapsibleSection } from "../../components/collapsible-section";
import { ConcernedPlayersPicker } from "../../components/concerned-players-picker";
import { CancelEventPanel } from "../../components/cancel-event-panel";
import { ConvocationActions } from "../../components/convocation-actions";
import { MatchAnalysis } from "../../components/match-analysis";
import { MatchClockPanel } from "../../components/match-clock";
import { initials, MatchPitch, pitchStyles } from "../../components/match-pitch";
import { MatchResultForm } from "../../components/match-result-form";
import { PlayerPicker } from "../../components/player-picker";
import { PlaceInput } from "../../components/place-input";
import { useAuth, type MobileMatch } from "../../lib/auth-context";
import { selectionSummary } from "../../lib/selection-summary";
import { themedStyles } from "../../lib/themed-styles";

const venueLabel: Record<MatchVenue, string> = { home: "Domicile", away: "Extérieur" };

function toMatchPlan(match: MobileMatch): MatchPlan {
  return {
    opponent: match.opponent,
    dateLabel: match.dateLabel,
    venue: match.venue,
    gameFormat: match.gameFormat as GameFormat,
    formationId: match.formationId,
    status: match.status,
    lineup: match.lineup,
    captainPlayerId: match.captainPlayerId,
    substitutePlayerIds: match.substitutePlayerIds,
  };
}

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { roster, getMatch, updateMatchLineup, changeMatchFormation, markMatchPlayed, apiRequest } = useAuth();
  const [match, setMatch] = useState<MobileMatch | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);
  const [benchPicking, setBenchPicking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [location, setLocation] = useState("");
  const [locationFeedback, setLocationFeedback] = useState("");
  const [selection, setSelection] = useState<PlayerSelection>(null);
  const [selectionFeedback, setSelectionFeedback] = useState("");

  useEffect(() => {
    (async () => {
      const result = await getMatch(id);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setMatch(result.match);
      setLocation(result.match.location ?? "");
      setSelection(result.match.selectedPlayerIds ?? null);
    })();
  }, [id, getMatch]);

  // Relit le match après l'envoi d'une convocation : date d'envoi et réponses.
  async function refreshMatch() {
    const result = await getMatch(id);
    if (result.ok) setMatch((current) => (current ? { ...current, convokedAt: result.match.convokedAt, attendance: result.match.attendance } : result.match));
  }

  // Même route que la fiche match du web (lieu seul : les autres détails restent inchangés).
  async function saveLocation() {
    setLocationFeedback("");
    const response = await apiRequest(`/api/matches/${encodeURIComponent(id)}/details`, {
      method: "PATCH",
      body: JSON.stringify({ location: location.trim() || null }),
    });
    setLocationFeedback(response?.ok ? "Lieu enregistré." : "Le lieu n’a pas été enregistré, réessaie.");
  }

  // Joueurs concernés : même route que la fiche match du web ; seuls eux entrent dans la composition.
  async function saveSelection() {
    setSelectionFeedback("");
    const response = await apiRequest(`/api/matches/${encodeURIComponent(id)}/details`, {
      method: "PATCH",
      body: JSON.stringify({ selectedPlayerIds: selection }),
    });
    const body = response?.ok ? await response.json().catch(() => null) : null;
    if (!body?.match) {
      setSelectionFeedback("Les joueurs concernés n’ont pas été enregistrés, réessaie.");
      return;
    }
    setMatch((current) => (current ? { ...current, selectedPlayerIds: body.match.selectedPlayerIds ?? null } : current));
    setSelectionFeedback("Joueurs concernés enregistrés.");
  }

  async function persist(nextMatch: MobileMatch) {
    setSaveError("");
    setMatch(nextMatch);
    const result = await updateMatchLineup(id, nextMatch.lineup, nextMatch.captainPlayerId, nextMatch.substitutePlayerIds);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setMatch(result.match);
  }

  function assignSlot(slotId: string, playerId: string | null) {
    if (!match) {
      return;
    }
    if (!playerId) {
      const plan = clearSlot(toMatchPlan(match), slotId);
      persist({ ...match, lineup: [...plan.lineup], captainPlayerId: plan.captainPlayerId });
      return;
    }
    const player = roster.find((candidate) => candidate.id === playerId);
    if (!player) {
      return;
    }
    const plan = assignPlayerToSlot(toMatchPlan(match), slotId, player);
    persist({ ...match, lineup: [...plan.lineup], captainPlayerId: plan.captainPlayerId });
  }

  // Banc des remplaçants (même principe que le web, match-prep-view.tsx) : un joueur placé sur le
  // banc quitte son poste de titulaire.
  function addToBench(playerId: string) {
    if (!match) return;
    const player = roster.find((candidate) => candidate.id === playerId);
    if (!player) return;
    const plan = addSubstitute(toMatchPlan(match), player);
    persist({ ...match, lineup: [...plan.lineup], captainPlayerId: plan.captainPlayerId, substitutePlayerIds: [...plan.substitutePlayerIds] });
  }

  function removeFromBench(playerId: string) {
    if (!match) return;
    const plan = removeSubstitute(toMatchPlan(match), playerId);
    persist({ ...match, substitutePlayerIds: [...plan.substitutePlayerIds] });
  }

  function setCaptain(playerId: string | null) {
    if (!match) {
      return;
    }
    persist({ ...match, captainPlayerId: playerId });
  }

  async function changeFormation(formationId: string) {
    if (!match || formationId === match.formationId) {
      return;
    }
    setSaveError("");
    const result = await changeMatchFormation(id, formationId);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setMatch(result.match);
  }

  async function finalize() {
    setFinalizing(true);
    setSaveError("");
    const result = await markMatchPlayed(id);
    setFinalizing(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    // Reste sur la fiche : le résultat (score, buteurs, passeurs) se saisit tout de suite, l'observation ensuite.
    setMatch(result.match);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  async function reopen() {
    setFinalizing(true);
    setSaveError("");
    const result = await markMatchPlayed(id, false);
    setFinalizing(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setMatch(result.match);
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

  if (!match) {
    return <SafeAreaView style={styles.safe} />;
  }

  const gameFormat = match.gameFormat as GameFormat;
  const formations = listFormations(gameFormat);
  const slots = formationSlots(gameFormat, match.formationId);
  const readOnly = match.status === "played";
  const canFinalize = canFinalizeMatchPlan(toMatchPlan(match));
  // Ce qui manque pour pouvoir marquer le match comme joué (adversaire, date).
  const missing = Object.values(validateMatchPlan(toMatchPlan(match)));
  // Joueurs de la feuille de match, titulaires puis remplaçants : ceux à qui attribuer buts et passes.
  const sheetPlayers = [
    ...match.lineup.map((assignment) => ({ id: assignment.playerId, name: assignment.playerName })),
    ...match.substitutePlayerIds.flatMap((playerId) => {
      const player = roster.find((candidate) => candidate.id === playerId);
      return player ? [{ id: player.id, name: player.name }] : [];
    }),
  ].filter((player, index, all) => all.findIndex((other) => other.id === player.id) === index);
  // Sans composition préparée, buts et passes s'attribuent parmi les joueurs concernés.
  const resultPlayers =
    sheetPlayers.length > 0 ? sheetPlayers : concernedPlayers(roster, match.selectedPlayerIds ?? null).map((player) => ({ id: player.id, name: player.name }));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} ref={scrollRef}>
        <Text style={styles.step}>{match.status === "played" ? "MATCH JOUÉ" : "PRÉPARATION DU MATCH"}</Text>
        <Text style={styles.title}>{match.opponent}</Text>
        <Text style={styles.body}>
          {match.dateLabel} · {venueLabel[match.venue]} · Foot à {match.gameFormat}
        </Text>

        <View style={styles.locationBlock}>
          <Text style={styles.locationLabel}>Lieu</Text>
          <PlaceInput
            onChange={(value) => {
              setLocation(value);
              setLocationFeedback("");
            }}
            value={location}
          />
          <TouchableOpacity accessibilityRole="button" onPress={saveLocation} style={styles.locationSave}>
            <Text style={styles.locationSaveText}>Enregistrer le lieu</Text>
          </TouchableOpacity>
          {locationFeedback ? <Text style={styles.body}>{locationFeedback}</Text> : null}
        </View>

        {!readOnly && (
          <View style={styles.concerned}>
            <CollapsibleSection summary={selectionSummary(selection, roster.length)} title="Joueurs concernés">
              <ConcernedPlayersPicker
                hint="Seuls les joueurs cochés voient le match, reçoivent la convocation et entrent dans la composition."
                onChange={(value) => {
                  setSelection(value);
                  setSelectionFeedback("");
                }}
                roster={roster}
                value={selection}
              />
            </CollapsibleSection>
            {JSON.stringify(selection) !== JSON.stringify(match.selectedPlayerIds ?? null) && (
              <TouchableOpacity accessibilityRole="button" disabled={selection?.length === 0} onPress={saveSelection} style={styles.locationSave}>
                <Text style={styles.locationSaveText}>Enregistrer les joueurs concernés</Text>
              </TouchableOpacity>
            )}
            {selectionFeedback ? <Text style={styles.body}>{selectionFeedback}</Text> : null}
          </View>
        )}

        <View style={styles.concerned}>
          <ConvocationActions
            attendance={match.attendance}
            canSend={!readOnly}
            convokeUrl={`/api/matches/${encodeURIComponent(match.id)}/convoke`}
            convokedAt={match.convokedAt ?? null}
            onSent={refreshMatch}
            roster={roster}
            scheduledText="Les joueurs concernés voient le match sans pouvoir répondre tant que la convocation n’est pas envoyée."
            selectedPlayerIds={match.selectedPlayerIds}
          />
          {!readOnly ? (
            <CancelEventPanel
              cancellationNote={match.cancellationNote}
              cancelledAt={match.cancelledAt}
              noun="le match"
              onChange={(state) => setMatch((current) => (current ? { ...current, ...state } : current))}
              url={`/api/matches/${encodeURIComponent(match.id)}/cancel`}
            />
          ) : null}
        </View>

        {readOnly ? (
          <CollapsibleSection
            summary={match.goalsFor != null && match.goalsAgainst != null ? `${match.goalsFor} - ${match.goalsAgainst}` : "Pas encore saisi"}
            title="Résultat du match"
          >
            <MatchResultForm
              goalsAgainst={match.goalsAgainst ?? null}
              goalsFor={match.goalsFor ?? null}
              key={match.id}
              matchId={match.id}
              onSaved={(result) => setMatch((current) => (current ? { ...current, ...result } : current))}
              playerStats={match.playerStats ?? []}
              players={resultPlayers}
            />
          </CollapsibleSection>
        ) : (
          <MatchClockPanel matchId={match.id} />
        )}

        {/* Composition facultative, repliée comme le résultat. */}
        <CollapsibleSection
          style={{ marginTop: spacing.md }}
          summary={match.lineup.length > 0 ? `${match.lineup.length} titulaires · ${match.substitutePlayerIds.length} remplaçants` : "Facultative"}
          title="Composition"
        >
          {!readOnly && formations.length > 1 && (
            <View style={styles.formationRow}>
              {formations.map((formation) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: formation.id === match.formationId }}
                  key={formation.id}
                  onPress={() => changeFormation(formation.id)}
                  style={[styles.formationChoice, formation.id === match.formationId && styles.formationChoiceActive]}
                >
                  <Text style={[styles.formationChoiceText, formation.id === match.formationId && styles.formationChoiceTextActive]}>{formation.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.pitchWrap}>
            <MatchPitch
              captainPlayerId={match.captainPlayerId}
              lineup={match.lineup}
              numberOf={(playerId) => roster.find((player) => player.id === playerId)?.jerseyNumber || null}
              onSlotTap={
                readOnly
                  ? undefined
                  : (slotId) => {
                      setPickerSlotId(slotId);
                    }
              }
              slots={slots}
            />
          </View>

          <View style={styles.bench}>
            <Text style={styles.benchTitle}>Remplaçants{readOnly ? "" : ` (max. ${maxSubstitutes(match.gameFormat as GameFormat)})`}</Text>
            <View style={styles.benchRow}>
              {Array.from({ length: maxSubstitutes(match.gameFormat as GameFormat) }, (_, index) => {
                const playerId = match.substitutePlayerIds[index];
                const player = playerId ? roster.find((candidate) => candidate.id === playerId) : null;
                return (
                  <TouchableOpacity
                    accessibilityLabel={player ? `Remplaçant : ${player.name}` : "Remplaçant : aucun joueur, toucher pour affecter"}
                    accessibilityRole="button"
                    disabled={readOnly}
                    key={index}
                    onPress={() =>
                      player
                        ? Alert.alert(`Retirer ${player.name} du banc ?`, undefined, [
                            { text: "Annuler", style: "cancel" },
                            { text: "Retirer", style: "destructive", onPress: () => removeFromBench(player.id) },
                          ])
                        : setBenchPicking(true)
                    }
                    style={styles.benchItem}
                  >
                    <View style={[pitchStyles.token, player && pitchStyles.tokenFilled]}>
                      <Text style={[pitchStyles.tokenText, player && pitchStyles.tokenTextFilled]}>{player ? initials(player.name) : "+"}</Text>
                    </View>
                    <Text numberOfLines={1} style={[styles.benchName, !player && styles.benchNameFree]}>
                      {player ? player.name.split(" ")[0] : "Libre"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* La composition se fait directement sur le terrain : pas de liste des postes en dessous. */}
          {!readOnly && <Text style={styles.sectionHint}>Touche un poste sur le terrain pour y affecter un joueur.</Text>}
        </CollapsibleSection>

        {saveError ? <Text style={styles.fieldError}>{saveError}</Text> : null}

        <MatchAnalysis formationId={match.formationId} gameFormat={gameFormat} matchId={match.id} opponentFormationId={match.opponentFormationId ?? null} />

        {!readOnly && (
          <View style={styles.resultInfo}>
            <Text style={styles.resultInfoTitle}>Score, buteurs et passeurs</Text>
            <Text style={styles.resultInfoText}>
              {canFinalize
                ? "Marque le match comme joué : le formulaire du score s’affiche aussitôt en haut de la fiche."
                : `Le score se saisit une fois le match marqué comme joué. Il manque : ${missing.join(" ").replace(/\.\s*/g, ". ").trim()}`}
            </Text>
          </View>
        )}

        {!readOnly ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: !canFinalize || finalizing }}
            disabled={!canFinalize || finalizing}
            onPress={finalize}
            style={[styles.finalizeButton, (!canFinalize || finalizing) && styles.finalizeButtonDisabled]}
          >
            <Text style={styles.finalizeButtonText}>{finalizing ? "…" : "Marquer comme joué →"}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity accessibilityRole="button" onPress={() => router.push(`/observation?type=match&matchId=${id}`)} style={styles.finalizeButton}>
              <Text style={styles.finalizeButtonText}>Ajouter une observation →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={finalizing}
              onPress={() =>
                Alert.alert("Rouvrir ce match ?", "Il redevient à préparer : composition, convocation et lieu modifiables. Le score saisi est gardé.", [
                  { text: "Annuler", style: "cancel" },
                  { text: "Rouvrir", onPress: () => void reopen() },
                ])
              }
              style={styles.reopenButton}
            >
              <Text style={styles.reopenButtonText}>{finalizing ? "…" : "Rouvrir ce match"}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <PlayerPicker
        captainPlayerId={match.captainPlayerId}
        onToggleCaptain={readOnly ? undefined : (playerId) => setCaptain(match.captainPlayerId === playerId ? null : playerId)}
        currentPlayerId={match.lineup.find((assignment) => assignment.slotId === pickerSlotId)?.playerId ?? null}
        onClear={() => {
          if (pickerSlotId) assignSlot(pickerSlotId, null);
          setPickerSlotId(null);
        }}
        onClose={() => setPickerSlotId(null)}
        onPick={(playerId) => {
          if (pickerSlotId) assignSlot(pickerSlotId, playerId);
          setPickerSlotId(null);
        }}
        // Joueurs concernés, plus ceux déjà placés s'ils ont été décochés depuis.
        players={roster.filter(
          (player) =>
            concernedPlayers([player], match.selectedPlayerIds ?? null).length > 0 || match.lineup.some((assignment) => assignment.playerId === player.id),
        )}
        statusOf={(playerId) => {
          const elsewhere = match.lineup.find((assignment) => assignment.playerId === playerId && assignment.slotId !== pickerSlotId);
          if (elsewhere) return "déjà titulaire";
          return match.substitutePlayerIds.includes(playerId) ? "remplaçant" : null;
        }}
        title={`Choisir un joueur${slots.find((slot) => slot.id === pickerSlotId) ? ` · ${slots.find((slot) => slot.id === pickerSlotId)!.roleLabel}` : ""}`}
        visible={pickerSlotId !== null}
      />
      <PlayerPicker
        onClose={() => setBenchPicking(false)}
        onPick={(playerId) => {
          addToBench(playerId);
          setBenchPicking(false);
        }}
        players={roster.filter(
          (player) => concernedPlayers([player], match.selectedPlayerIds ?? null).length > 0 && !match.substitutePlayerIds.includes(player.id),
        )}
        statusOf={(playerId) => (match.lineup.some((assignment) => assignment.playerId === playerId) ? "déjà titulaire" : null)}
        title="Choisir un remplaçant"
        visible={benchPicking}
      />
    </SafeAreaView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
    page: { padding: spacing.lg, paddingBottom: 50 },
    step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
    title: { fontSize: 26, fontWeight: "800", color: colors.ink, marginTop: 8 },
    body: { fontSize: 12.5, color: colors.muted, marginTop: 6 },
    locationBlock: { marginTop: spacing.md, gap: 6 },
    locationLabel: { fontSize: 11, fontWeight: "800", color: colors.muted },
    concerned: { marginTop: spacing.md, gap: spacing.sm },
    bench: { marginTop: spacing.md, padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
    benchTitle: { color: colors.ink, fontSize: 15, fontWeight: "800", marginBottom: spacing.sm },
    benchRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    benchItem: { width: 64, alignItems: "center", gap: 4 },
    benchName: { maxWidth: 64, color: colors.ink, fontSize: 11, fontWeight: "800" },
    benchNameFree: { color: colors.muted, fontWeight: "700" },
    locationSave: {
      alignSelf: "flex-start",
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    locationSaveText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
    formationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
    formationChoice: {
      minHeight: 36,
      paddingHorizontal: 13,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    formationChoiceActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    formationChoiceText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
    formationChoiceTextActive: { color: colors.primary },
    pitchWrap: { marginTop: 16 },

    sectionHint: { fontSize: 11, color: colors.muted, marginBottom: 8 },
    fieldError: { color: colors.danger, fontSize: 11, marginTop: 14 },
    resultInfo: {
      marginTop: spacing.md,
      padding: spacing.md,
      gap: 4,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    resultInfoTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
    resultInfoText: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
    finalizeButton: { minHeight: 48, marginTop: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: radii.sm },
    finalizeButtonDisabled: { opacity: 0.45 },
    finalizeButtonText: { color: colors.primaryInk, fontSize: 12, fontWeight: "800" },
    reopenButton: {
      minHeight: 46,
      marginTop: 12,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    reopenButtonText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
    modalClose: {
      minHeight: 44,
      marginTop: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.sm,
    },
  }),
);
