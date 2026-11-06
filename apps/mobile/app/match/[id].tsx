import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { assignPlayerToSlot, canFinalizeMatchPlan, clearSlot, concernedPlayers, formationSlots, listFormations } from "@evolyfoot/domain";
import type { GameFormat, MatchLineupSlot, MatchPlan, MatchVenue, PlayerSelection } from "@evolyfoot/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConcernedPlayersPicker } from "../../components/concerned-players-picker";
import { MatchAnalysis } from "../../components/match-analysis";
import { PlayerPicker } from "../../components/player-picker";
import { PlaceInput } from "../../components/place-input";
import { useAuth, type MobileMatch } from "../../lib/auth-context";

const venueLabel: Record<MatchVenue, string> = { home: "Domicile", away: "Extérieur" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

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

// Positions dérivées de la formation choisie (formationSlots) -- pas de dépendance SVG
// (react-native-svg n'est pas installée dans ce projet), un terrain vertical en `View`
// positionnées en pourcentage sur un repère 300x460 fait tout aussi bien l'affaire, dans le même
// esprit que les schémas tactiques web (TacticalDiagramView). Chaque poste est une vraie
// TouchableOpacity : toucher un poste directement sur le terrain ouvre le même sélecteur que la
// liste juste en dessous.
function MatchPitch({
  slots,
  match,
  numberOf,
  onSlotTap,
}: {
  slots: readonly MatchLineupSlot[];
  match: MobileMatch;
  numberOf: (playerId: string) => string | null;
  onSlotTap?: (slotId: string) => void;
}) {
  return (
    <View style={pitchStyles.pitch}>
      {/* Lignes du terrain : médiane, rond central, surfaces de réparation et de but. Les postes
          sont placés entre 6 % et 90 % de la hauteur pour que le prénom du gardien reste visible. */}
      <View pointerEvents="none" style={pitchStyles.halfway} />
      <View pointerEvents="none" style={pitchStyles.centerCircle} />
      <View pointerEvents="none" style={[pitchStyles.box, pitchStyles.boxTop]} />
      <View pointerEvents="none" style={[pitchStyles.box, pitchStyles.boxBottom]} />
      <View pointerEvents="none" style={[pitchStyles.goalArea, pitchStyles.boxTop]} />
      <View pointerEvents="none" style={[pitchStyles.goalArea, pitchStyles.boxBottom]} />
      {slots.map((slot) => {
        const assignment = match.lineup.find((candidate) => candidate.slotId === slot.id);
        const isCaptain = Boolean(assignment && assignment.playerId === match.captainPlayerId);
        return (
          // Pastille agrandie (numéro ou initiales) et prénom du joueur juste en dessous.
          <View key={slot.id} style={[pitchStyles.slot, { left: `${(slot.x / 300) * 100}%`, top: `${6 + (slot.y / 460) * 84}%` }]}>
            <TouchableOpacity
              accessibilityLabel={
                assignment
                  ? `${slot.roleLabel} : ${assignment.playerName}${isCaptain ? ", capitaine" : ""}`
                  : `${slot.roleLabel} : aucun joueur, toucher pour affecter`
              }
              accessibilityRole="button"
              disabled={!onSlotTap}
              onPress={() => onSlotTap?.(slot.id)}
              style={[pitchStyles.token, assignment && pitchStyles.tokenFilled]}
            >
              <Text style={[pitchStyles.tokenText, assignment && pitchStyles.tokenTextFilled]}>
                {assignment ? (numberOf(assignment.playerId) ?? initials(assignment.playerName)) : onSlotTap ? "+" : slot.roleLabel.slice(0, 1)}
              </Text>
              {isCaptain && <Text style={pitchStyles.captainBadge}>C</Text>}
            </TouchableOpacity>
            <Text numberOfLines={1} style={[pitchStyles.slotName, !assignment && pitchStyles.slotNameFree]}>
              {assignment ? assignment.playerName.split(" ")[0] : slot.roleLabel.replace(/ \d+$/, "")}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const pitchStyles = StyleSheet.create({
  pitch: {
    width: "100%",
    aspectRatio: 300 / 460,
    backgroundColor: "#0f2a1c",
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,.14)",
    overflow: "hidden",
  },
  halfway: { position: "absolute", left: 0, right: 0, top: "50%", height: 1.5, backgroundColor: "rgba(255,255,255,.14)" },
  centerCircle: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 80,
    height: 80,
    marginLeft: -40,
    marginTop: -40,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,.14)",
  },
  box: { position: "absolute", left: "25%", right: "25%", height: "12%", borderWidth: 1.5, borderColor: "rgba(255,255,255,.14)" },
  goalArea: { position: "absolute", left: "38%", right: "38%", height: "5%", borderWidth: 1.5, borderColor: "rgba(255,255,255,.14)" },
  boxTop: { top: -1.5 },
  boxBottom: { bottom: -1.5 },
  slot: { position: "absolute", width: 92, marginLeft: -46, marginTop: -28, alignItems: "center", gap: 4 },
  slotName: { maxWidth: 92, color: colors.ink, fontSize: 12, fontWeight: "800", textShadowColor: "rgba(0,0,0,.6)", textShadowRadius: 3 },
  slotNameFree: { color: colors.muted, fontWeight: "700" },
  token: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
  },
  // Halo autour d’un poste occupé, aux couleurs de la marque.
  tokenFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    shadowColor: colors.primary,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  tokenText: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  tokenTextFilled: { color: colors.primaryInk },
  captainBadge: { position: "absolute", top: -6, right: -6, color: colors.warn, fontSize: 14, fontWeight: "900" },
});

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { roster, getMatch, updateMatchLineup, changeMatchFormation, markMatchPlayed, apiRequest } = useAuth();
  const [match, setMatch] = useState<MobileMatch | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);
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
    const result = await updateMatchLineup(id, nextMatch.lineup, nextMatch.captainPlayerId);
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
    router.push(`/observation?type=match&matchId=${id}`);
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
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
            <ConcernedPlayersPicker
              hint="Seuls les joueurs cochés voient le match, reçoivent la convocation et entrent dans la composition."
              onChange={(value) => {
                setSelection(value);
                setSelectionFeedback("");
              }}
              roster={roster}
              value={selection}
            />
            {JSON.stringify(selection) !== JSON.stringify(match.selectedPlayerIds ?? null) && (
              <TouchableOpacity accessibilityRole="button" disabled={selection?.length === 0} onPress={saveSelection} style={styles.locationSave}>
                <Text style={styles.locationSaveText}>Enregistrer les joueurs concernés</Text>
              </TouchableOpacity>
            )}
            {selectionFeedback ? <Text style={styles.body}>{selectionFeedback}</Text> : null}
          </View>
        )}

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
            match={match}
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

        {/* La composition se fait directement sur le terrain : pas de liste des postes en dessous. */}
        {!readOnly && <Text style={styles.sectionHint}>Touche un poste sur le terrain pour y affecter un joueur.</Text>}

        {saveError ? <Text style={styles.fieldError}>{saveError}</Text> : null}

        <MatchAnalysis formationId={match.formationId} gameFormat={gameFormat} matchId={match.id} opponentFormationId={match.opponentFormationId ?? null} />

        {!readOnly ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: !canFinalize || finalizing }}
            disabled={!canFinalize || finalizing}
            onPress={finalize}
            style={[styles.finalizeButton, (!canFinalize || finalizing) && styles.finalizeButtonDisabled]}
          >
            <Text style={styles.finalizeButtonText}>{finalizing ? "…" : "Marquer comme joué & observer →"}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push(`/observation?type=match&matchId=${id}`)} style={styles.finalizeButton}>
            <Text style={styles.finalizeButtonText}>Ajouter une observation →</Text>
          </TouchableOpacity>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 50 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink, marginTop: 8 },
  body: { fontSize: 12.5, color: colors.muted, marginTop: 6 },
  locationBlock: { marginTop: spacing.md, gap: 6 },
  locationLabel: { fontSize: 11, fontWeight: "800", color: colors.muted },
  concerned: { marginTop: spacing.md, gap: spacing.sm },
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
  finalizeButton: { minHeight: 48, marginTop: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: radii.sm },
  finalizeButtonDisabled: { opacity: 0.45 },
  finalizeButtonText: { color: colors.primaryInk, fontSize: 12, fontWeight: "800" },
  modalClose: {
    minHeight: 44,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
  },
});
