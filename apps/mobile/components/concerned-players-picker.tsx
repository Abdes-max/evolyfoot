import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import type { PlayerSelection } from "@evolyfoot/domain";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface ConcernedPlayer {
  id: string;
  name: string;
}

// Joueurs concernés par un événement, cochés parmi l'effectif (même écran que le web,
// concerned-players-picker.tsx) : tous par défaut, tout cocher renvoie `null` (tout l'effectif).
export function ConcernedPlayersPicker({
  roster,
  value,
  onChange,
  title = "Joueurs concernés",
  hint,
}: {
  roster: readonly ConcernedPlayer[];
  value: PlayerSelection;
  onChange: (value: PlayerSelection) => void;
  title?: string;
  hint?: string;
}) {
  const checked = new Set(value ?? roster.map((player) => player.id));
  const count = roster.filter((player) => checked.has(player.id)).length;

  function toggle(playerId: string) {
    const next = new Set(checked);
    if (next.has(playerId)) next.delete(playerId);
    else next.add(playerId);
    const ids = roster.map((player) => player.id).filter((id) => next.has(id));
    onChange(ids.length === roster.length ? null : ids);
  }

  if (roster.length === 0) {
    return <Text style={styles.hint}>Ajoute des joueurs à l’effectif pour choisir qui est concerné.</Text>;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{count === roster.length ? `tout l’effectif (${count})` : `${count} sur ${roster.length}`}</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button" disabled={count === roster.length} hitSlop={6} onPress={() => onChange(null)}>
          <Text style={[styles.link, count === roster.length && styles.disabled]}>Tout cocher</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={count === 0} hitSlop={6} onPress={() => onChange([])}>
          <Text style={[styles.link, count === 0 && styles.disabled]}>Tout décocher</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.chips}>
        {roster.map((player) => {
          const selected = checked.has(player.id);
          return (
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              key={player.id}
              onPress={() => toggle(player.id)}
              style={[styles.chip, selected && styles.selected]}
            >
              <Text style={[styles.chipText, !selected && styles.unchecked]}>
                {selected ? "✓ " : ""}
                {player.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {count === 0 ? <Text style={styles.error}>Coche au moins un joueur.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
  title: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  hint: { color: colors.muted, fontSize: 12.5 },
  actions: { flexDirection: "row", gap: spacing.md },
  link: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  unchecked: { color: colors.muted },
  error: { color: "#ff6b6b", fontSize: 13 },
});
