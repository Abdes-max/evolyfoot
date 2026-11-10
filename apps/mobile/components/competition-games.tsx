import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { competitionGamesMax, competitionRecordLabel, validateCompetitionGames, type CompetitionGame } from "@evolyfoot/domain";
import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { ScoreEditor, type ResultPlayer } from "./match-result-form";

interface DraftGame {
  id: string;
  opponent: string;
  goalsFor: number;
  goalsAgainst: number;
  stats: ReadonlyMap<string, { goals: number; assists: number }>;
}

function toDraft(game: CompetitionGame): DraftGame {
  return {
    id: game.id,
    opponent: game.opponent,
    goalsFor: game.goalsFor,
    goalsAgainst: game.goalsAgainst,
    stats: new Map(game.playerStats.map((stat) => [stat.playerId, { goals: stat.goals, assists: stat.assists }])),
  };
}

// Identifiant local d'une nouvelle rencontre, avant son enregistrement.
function newId(counter: number): string {
  return `g-${Date.now().toString(36)}-${counter}`;
}

// Rencontres d'un tournoi ou d'un plateau : l'équipe rencontrée, le score, et pour chaque rencontre les buteurs
// et passeurs parmi les joueurs concernés. On en ajoute autant que nécessaire ; tout s'enregistre en un geste.
export function CompetitionGames({
  gamesUrl,
  games,
  players,
  onSaved,
}: {
  gamesUrl: string;
  games: readonly CompetitionGame[];
  players: readonly ResultPlayer[];
  onSaved: (games: CompetitionGame[]) => void;
}) {
  const { apiRequest } = useAuth();
  const counter = useRef(0);
  const [drafts, setDrafts] = useState<DraftGame[]>(() => games.map(toDraft));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  function change(id: string, patch: Partial<DraftGame>) {
    setFeedback("");
    setError("");
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  function changeStat(id: string, playerId: string, field: "goals" | "assists", value: number) {
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== id) return draft;
        const stats = new Map(draft.stats);
        stats.set(playerId, { goals: 0, assists: 0, ...stats.get(playerId), [field]: value });
        return { ...draft, stats };
      }),
    );
    setFeedback("");
    setError("");
  }

  // Seuls les joueurs ayant marqué ou fait une passe sont enregistrés.
  function toGames(): CompetitionGame[] {
    return drafts.map((draft) => ({
      id: draft.id,
      opponent: draft.opponent.trim(),
      goalsFor: draft.goalsFor,
      goalsAgainst: draft.goalsAgainst,
      playerStats: players.flatMap((player) => {
        const stat = draft.stats.get(player.id);
        return stat && (stat.goals > 0 || stat.assists > 0) ? [{ playerId: player.id, playerName: player.name, goals: stat.goals, assists: stat.assists }] : [];
      }),
    }));
  }

  async function save() {
    const next = toGames();
    const problem = validateCompetitionGames(next);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError("");
    setFeedback("");
    const response = await apiRequest(gamesUrl, { method: "PUT", body: JSON.stringify({ games: next }) });
    setSaving(false);
    const body = response ? await response.json().catch(() => null) : null;
    if (!response?.ok) {
      setError(typeof body?.error === "string" ? body.error : "L’enregistrement a échoué, réessaie.");
      return;
    }
    setFeedback("Rencontres enregistrées : les stats des joueurs sont à jour dans l’app Player.");
    onSaved(Array.isArray(body?.games) ? body.games : next);
  }

  function add() {
    counter.current += 1;
    setDrafts((current) => [...current, { id: newId(counter.current), opponent: "", goalsFor: 0, goalsAgainst: 0, stats: new Map() }]);
    setFeedback("");
  }

  const record = competitionRecordLabel(toGames());

  return (
    <View style={styles.wrap}>
      {record ? <Text style={styles.record}>{record}</Text> : null}
      {drafts.length === 0 ? (
        <Text style={styles.hint}>Aucune rencontre pour l’instant. Ajoute les matchs joués, avec l’équipe rencontrée et le score.</Text>
      ) : null}

      {drafts.map((draft, index) => (
        <View key={draft.id} style={styles.game}>
          <View style={styles.gameHead}>
            <Text style={styles.gameTitle}>Rencontre {index + 1}</Text>
            <TouchableOpacity
              accessibilityLabel={`Retirer la rencontre ${index + 1}`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setDrafts((current) => current.filter((other) => other.id !== draft.id))}
            >
              <Text style={styles.remove}>Retirer</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            accessibilityLabel={`Équipe rencontrée, rencontre ${index + 1}`}
            maxLength={60}
            onChangeText={(opponent) => change(draft.id, { opponent })}
            placeholder="Équipe rencontrée"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={draft.opponent}
          />
          <ScoreEditor
            onAssists={(playerId, value) => changeStat(draft.id, playerId, "assists", value)}
            onGoals={(playerId, value) => changeStat(draft.id, playerId, "goals", value)}
            onScoreAgainst={(value) => change(draft.id, { goalsAgainst: value })}
            onScoreFor={(value) => change(draft.id, { goalsFor: value })}
            players={players}
            scoreAgainst={draft.goalsAgainst}
            scoreFor={draft.goalsFor}
            stats={draft.stats}
          />
        </View>
      ))}

      <TouchableOpacity accessibilityRole="button" disabled={drafts.length >= competitionGamesMax} onPress={add} style={styles.add}>
        <Text style={styles.addText}>+ Ajouter une rencontre</Text>
      </TouchableOpacity>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.save, saving && styles.disabled]}>
        <Text style={styles.saveText}>{saving ? "Enregistrement…" : "Enregistrer les rencontres"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  record: { color: colors.lime, fontSize: 14, fontWeight: "900" },
  hint: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  game: { gap: spacing.md, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  gameHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gameTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  remove: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm, padding: 12, color: colors.ink },
  add: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.primary },
  addText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  save: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
  saveText: { color: colors.primaryInk, fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, fontSize: 13, fontWeight: "700" },
  feedback: { color: colors.lime, fontSize: 13, fontWeight: "800" },
});
