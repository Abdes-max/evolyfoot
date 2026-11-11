import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { matchResultMaxGoals, validateMatchResult, type MatchPlayerStat } from "@evolyfoot/domain";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { themedStyles } from "../lib/themed-styles";

export interface ResultPlayer {
  id: string;
  name: string;
}

export interface SavedMatchResult {
  goalsFor: number;
  goalsAgainst: number;
  playerStats: MatchPlayerStat[];
}

// Pastilles − / + : plus sûres au pouce qu'un clavier numérique.
export function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <View accessibilityLabel={`${label} : ${value}`} accessibilityRole="adjustable" style={styles.stepper}>
      <TouchableOpacity
        accessibilityLabel={`Retirer un ${label.toLowerCase()}`}
        accessibilityRole="button"
        disabled={value <= 0}
        hitSlop={6}
        onPress={() => onChange(value - 1)}
        style={[styles.stepButton, value <= 0 && styles.disabled]}
      >
        <Text style={styles.stepText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value}</Text>
      <TouchableOpacity
        accessibilityLabel={`Ajouter un ${label.toLowerCase()}`}
        accessibilityRole="button"
        disabled={value >= matchResultMaxGoals}
        hitSlop={6}
        onPress={() => onChange(value + 1)}
        style={[styles.stepButton, value >= matchResultMaxGoals && styles.disabled]}
      >
        <Text style={styles.stepText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export type PlayerStatsMap = ReadonlyMap<string, { goals: number; assists: number }>;

// Score (nous / adversaire) puis buts et passes décisives de chaque joueur : partagé entre le résultat d'un match
// et chaque rencontre d'un tournoi ou d'un plateau.
export function ScoreEditor({
  players,
  scoreFor,
  scoreAgainst,
  stats,
  onScoreFor,
  onScoreAgainst,
  onGoals,
  onAssists,
}: {
  players: readonly ResultPlayer[];
  scoreFor: number;
  scoreAgainst: number;
  stats: PlayerStatsMap;
  onScoreFor: (value: number) => void;
  onScoreAgainst: (value: number) => void;
  onGoals: (playerId: string, value: number) => void;
  onAssists: (playerId: string, value: number) => void;
}) {
  const scorers = players.reduce((sum, player) => sum + (stats.get(player.id)?.goals ?? 0), 0);
  return (
    <>
      <View style={styles.score}>
        <View style={styles.scoreSide}>
          <Text style={styles.scoreLabel}>Nous</Text>
          <Stepper label="But pour nous" onChange={onScoreFor} value={scoreFor} />
        </View>
        <Text style={styles.dash}>–</Text>
        <View style={styles.scoreSide}>
          <Text style={styles.scoreLabel}>Adversaire</Text>
          <Stepper label="But adverse" onChange={onScoreAgainst} value={scoreAgainst} />
        </View>
      </View>

      {players.length > 0 ? (
        <View style={styles.players}>
          <View style={styles.playersHead}>
            <Text style={[styles.headText, { flex: 1 }]}>Joueur</Text>
            <Text style={[styles.headText, styles.col]}>Buts</Text>
            <Text style={[styles.headText, styles.col]}>Passes</Text>
          </View>
          {players.map((player) => {
            const stat = stats.get(player.id) ?? { goals: 0, assists: 0 };
            return (
              <View key={player.id} style={styles.playerRow}>
                <Text numberOfLines={1} style={styles.playerName}>
                  {player.name}
                </Text>
                <View style={styles.col}>
                  <Stepper label={`But de ${player.name}`} onChange={(value) => onGoals(player.id, value)} value={stat.goals} />
                </View>
                <View style={styles.col}>
                  <Stepper label={`Passe décisive de ${player.name}`} onChange={(value) => onAssists(player.id, value)} value={stat.assists} />
                </View>
              </View>
            );
          })}
          <Text style={styles.hint}>
            {scorers} buteur{scorers > 1 ? "s" : ""} déclaré{scorers > 1 ? "s" : ""} sur {scoreFor} but{scoreFor > 1 ? "s" : ""}. Un but contre son camp ou d’un
            joueur hors feuille n’a pas besoin d’être attribué.
          </Text>
        </View>
      ) : (
        <Text style={styles.hint}>Compose l’équipe pour attribuer les buts et les passes.</Text>
      )}
    </>
  );
}

// Résultat d'un match joué (même écran que le web, match-result-form.tsx) : le score, puis les buts et
// les passes décisives de chaque joueur de la feuille de match. Ils alimentent les stats de la carte du
// joueur dans l'app Player.
export function MatchResultForm({
  matchId,
  players,
  goalsFor,
  goalsAgainst,
  playerStats,
  onSaved,
}: {
  matchId: string;
  players: readonly ResultPlayer[];
  goalsFor: number | null;
  goalsAgainst: number | null;
  playerStats: readonly MatchPlayerStat[];
  onSaved?: (result: SavedMatchResult) => void;
}) {
  const { apiRequest } = useAuth();
  const [scoreFor, setScoreFor] = useState(goalsFor ?? 0);
  const [scoreAgainst, setScoreAgainst] = useState(goalsAgainst ?? 0);
  const [stats, setStats] = useState<ReadonlyMap<string, { goals: number; assists: number }>>(
    () => new Map(playerStats.map((stat) => [stat.playerId, { goals: stat.goals, assists: stat.assists }])),
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  function update(playerId: string, field: "goals" | "assists", value: number) {
    setFeedback("");
    setError("");
    setStats((current) => {
      const next = new Map(current);
      next.set(playerId, { goals: 0, assists: 0, ...next.get(playerId), [field]: value });
      return next;
    });
  }

  // Seuls les joueurs ayant marqué ou fait une passe sont enregistrés.
  const entries: MatchPlayerStat[] = players.flatMap((player) => {
    const stat = stats.get(player.id);
    return stat && (stat.goals > 0 || stat.assists > 0) ? [{ playerId: player.id, playerName: player.name, goals: stat.goals, assists: stat.assists }] : [];
  });

  async function save() {
    const problem = validateMatchResult({ goalsFor: scoreFor, goalsAgainst: scoreAgainst, playerStats: entries });
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError("");
    setFeedback("");
    const response = await apiRequest(`/api/matches/${encodeURIComponent(matchId)}/result`, {
      method: "PUT",
      body: JSON.stringify({ goalsFor: scoreFor, goalsAgainst: scoreAgainst, playerStats: entries }),
    });
    setSaving(false);
    const body = response ? await response.json().catch(() => null) : null;
    if (!response?.ok) {
      setError(typeof body?.error === "string" ? body.error : "L’enregistrement a échoué, réessaie.");
      return;
    }
    setFeedback("Résultat enregistré : les stats des joueurs sont à jour dans l’app Player.");
    onSaved?.({ goalsFor: scoreFor, goalsAgainst: scoreAgainst, playerStats: entries });
  }

  return (
    <View style={styles.card}>
      <ScoreEditor
        onAssists={(playerId, value) => update(playerId, "assists", value)}
        onGoals={(playerId, value) => update(playerId, "goals", value)}
        onScoreAgainst={setScoreAgainst}
        onScoreFor={setScoreFor}
        players={players}
        scoreAgainst={scoreAgainst}
        scoreFor={scoreFor}
        stats={stats}
      />

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.save, saving && styles.disabled]}>
        <Text style={styles.saveText}>{saving ? "Enregistrement…" : "Enregistrer le résultat"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    card: {
      gap: spacing.md,
      padding: spacing.md,
      marginTop: spacing.md,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    title: { color: colors.ink, fontSize: 18, fontWeight: "900" },
    score: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
    scoreSide: { alignItems: "center", gap: 6 },
    scoreLabel: { color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
    dash: { color: colors.muted, fontSize: 28, fontWeight: "900" },
    players: { gap: 8 },
    playersHead: { flexDirection: "row", alignItems: "center" },
    headText: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
    col: { width: 104, alignItems: "center" },
    playerRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.line },
    playerName: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "700", paddingRight: 6 },
    stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
    stepButton: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    stepText: { color: colors.primary, fontSize: 18, fontWeight: "900", lineHeight: 20 },
    stepValue: { minWidth: 22, textAlign: "center", color: colors.ink, fontSize: 17, fontWeight: "900" },
    disabled: { opacity: 0.4 },
    hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
    error: { color: colors.danger, fontSize: 13, fontWeight: "700" },
    feedback: { color: colors.lime, fontSize: 13, fontWeight: "800" },
    save: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
    saveText: { color: colors.primaryInk, fontSize: 13, fontWeight: "900" },
  }),
);
