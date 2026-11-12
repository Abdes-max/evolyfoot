import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import {
  addSubstitute,
  assignPlayerToSlot,
  changeCompetitionFormation,
  clearSlot,
  emptyCompetitionLineup,
  formationSlots,
  gameFormats,
  lineupFromTemplate,
  listFormations,
  maxSubstitutes,
  removeSubstitute,
  type CompetitionLineup,
  type GameFormat,
  type MatchPlan,
} from "@evolyfoot/domain";
import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { themedStyles } from "../lib/themed-styles";
import { initials, MatchPitch, pitchStyles } from "./match-pitch";
import { PlayerPicker, type PickablePlayer } from "./player-picker";

// Les opérations de composition du domaine travaillent sur un MatchPlan : seuls les champs de la feuille comptent ici.
function asPlan(value: CompetitionLineup): MatchPlan {
  return {
    opponent: "",
    dateLabel: "",
    venue: "home",
    gameFormat: value.gameFormat,
    formationId: value.formationId,
    status: "scheduled",
    lineup: value.lineup,
    captainPlayerId: value.captainPlayerId,
    substitutePlayerIds: value.substitutePlayerIds,
  };
}

function fromPlan(value: CompetitionLineup, plan: MatchPlan): CompetitionLineup {
  return { ...value, lineup: [...plan.lineup], captainPlayerId: plan.captainPlayerId, substitutePlayerIds: [...plan.substitutePlayerIds] };
}

// Composition d'un tournoi ou d'un plateau, comme celle d'un match : format, formation, postes sur
// le terrain, capitaine et banc. Chaque changement est enregistré aussitôt.
export function CompetitionLineupEditor({
  lineupUrl,
  initial,
  defaultGameFormat,
  players,
  readOnly,
  maxBench,
  template,
  startLabel = "Préparer la composition",
}: {
  lineupUrl: string;
  initial: CompetitionLineup | null;
  defaultGameFormat: GameFormat;
  // Joueurs concernés (plus ceux déjà placés s’ils ont été décochés), avec poste et numéro.
  players: readonly PickablePlayer[];
  readOnly?: boolean;
  // Remplaçants au plus (6 pour la compo type) ; par défaut, la limite du format de jeu.
  maxBench?: number;
  // Compo type de l'équipe : point de départ proposé quand la compo est vide.
  template?: CompetitionLineup | null;
  startLabel?: string;
}) {
  const { apiRequest } = useAuth();
  const [value, setValue] = useState<CompetitionLineup>(() => initial ?? emptyCompetitionLineup(defaultGameFormat));
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);
  const [benchPicking, setBenchPicking] = useState(false);
  const [error, setError] = useState("");
  // Facultative : rien n'est affiché ni enregistré tant que le coach ne la prépare pas.
  const [started, setStarted] = useState(initial !== null);

  async function persist(next: CompetitionLineup) {
    setError("");
    setValue(next);
    const response = await apiRequest(lineupUrl, { method: "PUT", body: JSON.stringify({ lineup: next }) });
    const body = response ? await response.json().catch(() => null) : null;
    if (!response?.ok) {
      setError(typeof body?.error === "string" ? body.error : "La composition n’a pas été enregistrée, réessaie.");
      return;
    }
    if (body?.lineup) setValue(body.lineup);
  }

  const slots = formationSlots(value.gameFormat, value.formationId);
  const formations = listFormations(value.gameFormat);
  const benchMax = maxBench ?? maxSubstitutes(value.gameFormat);
  const benchSize = Math.max(benchMax, value.substitutePlayerIds.length);
  const nameOf = (playerId: string) =>
    players.find((player) => player.id === playerId)?.name ?? value.lineup.find((assignment) => assignment.playerId === playerId)?.playerName ?? "";

  function assignSlot(slotId: string, playerId: string | null) {
    if (!playerId) {
      void persist(fromPlan(value, clearSlot(asPlan(value), slotId)));
      return;
    }
    const player = players.find((candidate) => candidate.id === playerId);
    if (player) void persist(fromPlan(value, assignPlayerToSlot(asPlan(value), slotId, player)));
  }

  if (!started) {
    return readOnly ? (
      <Text style={styles.hint}>Pas de composition pour cette journée.</Text>
    ) : (
      <View style={styles.wrap}>
        {template ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              setStarted(true);
              void persist(lineupFromTemplate(template, new Set(players.map((player) => player.id))));
            }}
            style={styles.startPrimary}
          >
            <Text style={styles.startPrimaryText}>Partir de la compo type</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity accessibilityRole="button" onPress={() => setStarted(true)} style={styles.start}>
          <Text style={styles.startText}>{template ? "Compo vide" : startLabel}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {!readOnly && (
        <View style={styles.choiceRow}>
          {gameFormats.map((format) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: format === value.gameFormat }}
              key={format}
              onPress={() => format !== value.gameFormat && void persist(changeCompetitionFormation(value, format, listFormations(format)[0]!.id, maxBench))}
              style={[styles.choice, format === value.gameFormat && styles.choiceActive]}
            >
              <Text style={[styles.choiceText, format === value.gameFormat && styles.choiceTextActive]}>{`Foot à ${format}`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {!readOnly && formations.length > 1 && (
        <View style={styles.choiceRow}>
          {formations.map((formation) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: formation.id === value.formationId }}
              key={formation.id}
              onPress={() => formation.id !== value.formationId && void persist(changeCompetitionFormation(value, value.gameFormat, formation.id, maxBench))}
              style={[styles.choice, formation.id === value.formationId && styles.choiceActive]}
            >
              <Text style={[styles.choiceText, formation.id === value.formationId && styles.choiceTextActive]}>{formation.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <MatchPitch
        captainPlayerId={value.captainPlayerId}
        lineup={value.lineup}
        numberOf={(playerId) => players.find((player) => player.id === playerId)?.jerseyNumber || null}
        onSlotTap={readOnly ? undefined : setPickerSlotId}
        slots={slots}
      />
      {!readOnly && <Text style={styles.hint}>Touche un poste sur le terrain pour y affecter un joueur.</Text>}

      <View style={styles.bench}>
        <Text style={styles.benchTitle}>Remplaçants{readOnly ? "" : ` (max. ${benchMax})`}</Text>
        <View style={styles.benchRow}>
          {Array.from({ length: benchSize }, (_, index) => {
            const playerId = value.substitutePlayerIds[index];
            const name = playerId ? nameOf(playerId) : "";
            return (
              <TouchableOpacity
                accessibilityLabel={playerId ? `Remplaçant : ${name}` : "Remplaçant : aucun joueur, toucher pour affecter"}
                accessibilityRole="button"
                disabled={readOnly}
                key={index}
                onPress={() =>
                  playerId
                    ? Alert.alert(`Retirer ${name} du banc ?`, undefined, [
                        { text: "Annuler", style: "cancel" },
                        { text: "Retirer", style: "destructive", onPress: () => void persist(fromPlan(value, removeSubstitute(asPlan(value), playerId))) },
                      ])
                    : setBenchPicking(true)
                }
                style={styles.benchItem}
              >
                <View style={[pitchStyles.token, playerId && pitchStyles.tokenFilled]}>
                  <Text style={[pitchStyles.tokenText, playerId && pitchStyles.tokenTextFilled]}>{playerId ? initials(name) : "+"}</Text>
                </View>
                <Text numberOfLines={1} style={[styles.benchName, !playerId && styles.benchNameFree]}>
                  {playerId ? name.split(" ")[0] : "Libre"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PlayerPicker
        captainPlayerId={value.captainPlayerId}
        currentPlayerId={value.lineup.find((assignment) => assignment.slotId === pickerSlotId)?.playerId ?? null}
        onClear={() => {
          if (pickerSlotId) assignSlot(pickerSlotId, null);
          setPickerSlotId(null);
        }}
        onClose={() => setPickerSlotId(null)}
        onPick={(playerId) => {
          if (pickerSlotId) assignSlot(pickerSlotId, playerId);
          setPickerSlotId(null);
        }}
        onToggleCaptain={(playerId) => void persist({ ...value, captainPlayerId: value.captainPlayerId === playerId ? null : playerId })}
        players={players}
        statusOf={(playerId) => {
          if (value.lineup.some((assignment) => assignment.playerId === playerId && assignment.slotId !== pickerSlotId)) return "déjà titulaire";
          return value.substitutePlayerIds.includes(playerId) ? "remplaçant" : null;
        }}
        title={`Choisir un joueur${slots.find((slot) => slot.id === pickerSlotId) ? ` · ${slots.find((slot) => slot.id === pickerSlotId)!.roleLabel}` : ""}`}
        visible={pickerSlotId !== null}
      />
      <PlayerPicker
        onClose={() => setBenchPicking(false)}
        onPick={(playerId) => {
          const player = players.find((candidate) => candidate.id === playerId);
          if (player && value.substitutePlayerIds.length < benchMax) void persist(fromPlan(value, addSubstitute(asPlan(value), player)));
          setBenchPicking(false);
        }}
        players={players.filter((player) => !value.substitutePlayerIds.includes(player.id))}
        statusOf={(playerId) => (value.lineup.some((assignment) => assignment.playerId === playerId) ? "déjà titulaire" : null)}
        title="Choisir un remplaçant"
        visible={benchPicking}
      />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    wrap: { gap: spacing.md },
    choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    choice: {
      minHeight: 36,
      paddingHorizontal: 13,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    choiceActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    choiceText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
    choiceTextActive: { color: colors.primary },
    hint: { fontSize: 11, color: colors.muted },
    start: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.primary },
    startText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
    startPrimary: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
    startPrimaryText: { color: colors.primaryInk, fontSize: 13, fontWeight: "900" },
    bench: { padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
    benchTitle: { color: colors.ink, fontSize: 15, fontWeight: "800", marginBottom: spacing.sm },
    benchRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    benchItem: { width: 64, alignItems: "center", gap: 4 },
    benchName: { maxWidth: 64, color: colors.ink, fontSize: 11, fontWeight: "800" },
    benchNameFree: { color: colors.muted, fontWeight: "700" },
    error: { color: colors.danger, fontSize: 12, fontWeight: "700" },
  }),
);
