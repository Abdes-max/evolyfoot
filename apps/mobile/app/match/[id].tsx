import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { assignPlayerToSlot, canFinalizeMatchPlan, clearSlot, formationSlots, listFormations } from "@evolyfoot/domain";
import type { GameFormat, MatchLineupSlot, MatchPlan, MatchVenue } from "@evolyfoot/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  };
}

// Positions dérivées de la formation choisie (formationSlots) -- pas de dépendance SVG
// (react-native-svg n'est pas installée dans ce projet), un terrain vertical en `View`
// positionnées en pourcentage sur un repère 300x460 fait tout aussi bien l'affaire, dans le même
// esprit que les schémas tactiques web (TacticalDiagramView). Chaque poste est une vraie
// TouchableOpacity : toucher un poste directement sur le terrain ouvre le même sélecteur que la
// liste juste en dessous.
function MatchPitch({ slots, match, onSlotTap }: { slots: readonly MatchLineupSlot[]; match: MobileMatch; onSlotTap?: (slotId: string) => void }) {
  return (
    <View style={pitchStyles.pitch}>
      {slots.map((slot) => {
        const assignment = match.lineup.find((candidate) => candidate.slotId === slot.id);
        const isCaptain = Boolean(assignment && assignment.playerId === match.captainPlayerId);
        return (
          <TouchableOpacity
            accessibilityLabel={assignment ? `${slot.roleLabel} : ${assignment.playerName}${isCaptain ? ", capitaine" : ""}` : `${slot.roleLabel} : aucun joueur, toucher pour affecter`}
            accessibilityRole="button"
            disabled={!onSlotTap}
            key={slot.id}
            onPress={() => onSlotTap?.(slot.id)}
            style={[pitchStyles.token, assignment && pitchStyles.tokenFilled, { left: `${(slot.x / 300) * 100}%`, top: `${(slot.y / 460) * 100}%` }]}
          >
            <Text style={[pitchStyles.tokenText, assignment && pitchStyles.tokenTextFilled]}>
              {assignment ? initials(assignment.playerName) : slot.roleLabel.slice(0, 1)}
            </Text>
            {isCaptain && <Text style={pitchStyles.captainBadge}>C</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const pitchStyles = StyleSheet.create({
  pitch: { width: "100%", aspectRatio: 300 / 460, backgroundColor: "#0f2a1c", borderRadius: radii.lg, borderWidth: 1.5, borderColor: "rgba(255,255,255,.14)", overflow: "hidden" },
  token: { position: "absolute", width: 36, height: 36, marginLeft: -18, marginTop: -18, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line },
  tokenFilled: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  tokenText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  tokenTextFilled: { color: colors.primaryInk },
  captainBadge: { position: "absolute", top: -6, right: -10, color: colors.warn, fontSize: 12, fontWeight: "900" },
});

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { roster, getMatch, updateMatchLineup, changeMatchFormation, markMatchPlayed } = useAuth();
  const [match, setMatch] = useState<MobileMatch | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);
  const [pickerCaptain, setPickerCaptain] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await getMatch(id);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setMatch(result.match);
    })();
  }, [id, getMatch]);

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
  const assignedPlayerIds = new Set(match.lineup.map((assignment) => assignment.playerId));
  const canFinalize = canFinalizeMatchPlan(toMatchPlan(match));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.step}>{match.status === "played" ? "MATCH JOUÉ" : "PRÉPARATION DU MATCH"}</Text>
        <Text style={styles.title}>{match.opponent}</Text>
        <Text style={styles.body}>
          {match.dateLabel} · {venueLabel[match.venue]} · Foot à {match.gameFormat}
        </Text>

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
          <MatchPitch match={match} onSlotTap={readOnly ? undefined : (slotId) => { setPickerCaptain(false); setPickerSlotId(slotId); }} slots={slots} />
        </View>

        <Text style={styles.sectionTitle}>Composition</Text>
        <Text style={styles.sectionHint}>Touche un poste sur le terrain ou dans la liste pour y affecter un joueur.</Text>
        {slots.map((slot) => {
          const assignment = match.lineup.find((candidate) => candidate.slotId === slot.id);
          return (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={readOnly}
              key={slot.id}
              onPress={() => {
                setPickerCaptain(false);
                setPickerSlotId(slot.id);
              }}
              style={styles.slotRow}
            >
              <Text style={styles.slotLabel}>{slot.roleLabel}</Text>
              <Text style={styles.slotValue}>{assignment?.playerName ?? "— Aucun joueur —"}</Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          accessibilityRole="button"
          disabled={readOnly}
          onPress={() => {
            setPickerSlotId(null);
            setPickerCaptain(true);
          }}
          style={styles.captainRow}
        >
          <Text style={styles.slotLabel}>Capitaine</Text>
          <Text style={styles.slotValue}>{match.lineup.find((a) => a.playerId === match.captainPlayerId)?.playerName ?? "— Aucun —"}</Text>
        </TouchableOpacity>

        {saveError ? <Text style={styles.fieldError}>{saveError}</Text> : null}

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

      <Modal animationType="slide" onRequestClose={() => setPickerSlotId(null)} transparent visible={pickerSlotId !== null}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Choisir un joueur</Text>
            <ScrollView>
              <TouchableOpacity
                onPress={() => {
                  if (pickerSlotId) assignSlot(pickerSlotId, null);
                  setPickerSlotId(null);
                }}
                style={styles.modalOption}
              >
                <Text style={styles.modalOptionText}>— Aucun joueur —</Text>
              </TouchableOpacity>
              {roster
                .filter((player) => {
                  const currentAssignment = match.lineup.find((a) => a.slotId === pickerSlotId);
                  return player.id === currentAssignment?.playerId || !assignedPlayerIds.has(player.id);
                })
                .map((player) => (
                  <TouchableOpacity
                    key={player.id}
                    onPress={() => {
                      if (pickerSlotId) assignSlot(pickerSlotId, player.id);
                      setPickerSlotId(null);
                    }}
                    style={styles.modalOption}
                  >
                    <Text style={styles.modalOptionText}>{player.name}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setPickerSlotId(null)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setPickerCaptain(false)} transparent visible={pickerCaptain}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Choisir un capitaine</Text>
            <ScrollView>
              <TouchableOpacity
                onPress={() => {
                  setCaptain(null);
                  setPickerCaptain(false);
                }}
                style={styles.modalOption}
              >
                <Text style={styles.modalOptionText}>— Aucun —</Text>
              </TouchableOpacity>
              {match.lineup.map((assignment) => (
                <TouchableOpacity
                  key={assignment.playerId}
                  onPress={() => {
                    setCaptain(assignment.playerId);
                    setPickerCaptain(false);
                  }}
                  style={styles.modalOption}
                >
                  <Text style={styles.modalOptionText}>{assignment.playerName}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setPickerCaptain(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 50 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink, marginTop: 8 },
  body: { fontSize: 12.5, color: colors.muted, marginTop: 6 },
  formationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  formationChoice: { minHeight: 36, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  formationChoiceActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  formationChoiceText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  formationChoiceTextActive: { color: colors.primary },
  pitchWrap: { marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, marginTop: 24, marginBottom: 2 },
  sectionHint: { fontSize: 11, color: colors.muted, marginBottom: 8 },
  slotRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, backgroundColor: colors.surface, marginTop: 8 },
  slotLabel: { color: colors.muted, fontSize: 11.5, fontWeight: "700" },
  slotValue: { color: colors.ink, fontSize: 12.5, fontWeight: "700" },
  captainRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, backgroundColor: colors.primarySoft, marginTop: 18 },
  fieldError: { color: colors.danger, fontSize: 11, marginTop: 14 },
  finalizeButton: { minHeight: 48, marginTop: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: radii.sm },
  finalizeButtonDisabled: { opacity: 0.45 },
  finalizeButtonText: { color: colors.primaryInk, fontSize: 12, fontWeight: "800" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.5)" },
  modalSheet: { maxHeight: "70%", padding: spacing.lg, backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  modalTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, marginBottom: 12 },
  modalOption: { minHeight: 44, justifyContent: "center", paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: colors.line },
  modalOptionText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  modalClose: { minHeight: 44, marginTop: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm },
  modalCloseText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
});
