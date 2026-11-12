import { colors, radii } from "@evolyfoot/design-tokens";
import type { MatchLineupAssignment, MatchLineupSlot } from "@evolyfoot/domain";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { themedStyles } from "../lib/themed-styles";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

// Positions dérivées de la formation choisie (formationSlots) -- pas de dépendance SVG
// (react-native-svg n'est pas installée dans ce projet), un terrain vertical en `View`
// positionnées en pourcentage sur un repère 300x460 fait tout aussi bien l'affaire, dans le même
// esprit que les schémas tactiques web (TacticalDiagramView). Chaque poste est une vraie
// TouchableOpacity : toucher un poste directement sur le terrain ouvre le même sélecteur que la
// liste juste en dessous.
export function MatchPitch({
  slots,
  lineup,
  captainPlayerId,
  numberOf,
  onSlotTap,
}: {
  slots: readonly MatchLineupSlot[];
  lineup: readonly MatchLineupAssignment[];
  captainPlayerId: string | null;
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
        const assignment = lineup.find((candidate) => candidate.slotId === slot.id);
        const isCaptain = Boolean(assignment && assignment.playerId === captainPlayerId);
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

export const pitchStyles = themedStyles(() =>
  StyleSheet.create({
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
    slotName: { maxWidth: 92, color: "#f4f6f9", fontSize: 12, fontWeight: "800", textShadowColor: "rgba(0,0,0,.6)", textShadowRadius: 3 },
    slotNameFree: { color: "rgba(244,246,249,0.7)", fontWeight: "700" },
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
  }),
);
