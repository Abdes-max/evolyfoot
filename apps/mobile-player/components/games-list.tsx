import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import type { PlayerCompetitionGame } from "@evolyfoot/domain";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { themedStyles } from "../lib/themed-styles";

// Matchs, tournois et plateaux du joueur : adversaire, score et ce qu'il a fait. Repliée par défaut.
export function GamesList({ games }: { games: readonly PlayerCompetitionGame[] }) {
  const [open, setOpen] = useState(false);
  if (games.length === 0) {
    return null;
  }
  return (
    <View style={styles.card}>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mes matchs, tournois et plateaux</Text>
          <Text style={styles.summary}>{`${games.length} rencontre${games.length > 1 ? "s" : ""}`}</Text>
        </View>
        <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
      </TouchableOpacity>
      {open ? (
        <View style={styles.body}>
          {games.map((game, index) => (
            <View key={`${game.competitionName}-${index}`} style={styles.row}>
              <Text style={styles.rowTitle}>{`${game.competitionName} · ${game.dateLabel}`}</Text>
              <Text style={styles.rowDetail}>
                {`contre ${game.opponent}${game.goalsFor !== null && game.goalsAgainst !== null ? ` (${game.goalsFor}-${game.goalsAgainst})` : ""} : ${game.goals} but${game.goals > 1 ? "s" : ""}, ${game.assists} passe${game.assists > 1 ? "s" : ""} déc.`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    card: { marginTop: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" },
    head: { flexDirection: "row", alignItems: "center", padding: spacing.md },
    title: { color: colors.ink, fontSize: 15, fontWeight: "800" },
    summary: { color: colors.muted, fontSize: 12, marginTop: 2 },
    chevron: { color: colors.muted, fontSize: 18, paddingLeft: spacing.sm },
    body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
    row: { gap: 2, paddingTop: 8 },
    rowTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
    rowDetail: { color: colors.muted, fontSize: 12.5 },
  }),
);
