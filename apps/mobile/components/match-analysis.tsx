import { colors, radii } from "@evolyfoot/design-tokens";
import { analyzeMatchup, formationSlots, listFormations, type GameFormat, type LineBalance } from "@evolyfoot/domain";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import { useAuth } from "../lib/auth-context";

const balanceLabels: Record<LineBalance, string> = { advantage: "Surnombre", even: "Égalité", disadvantage: "Infériorité" };
const balanceColors: Record<LineBalance, string> = { advantage: colors.primary, even: colors.muted, disadvantage: colors.danger };
const pitchWidth = 300;
const pitchHeight = 460;
const theirColor = "#ff8f7a";

interface MatchAnalysisProps {
  matchId: string;
  gameFormat: GameFormat;
  formationId: string;
  opponentFormationId: string | null;
}

// Même analyse que la fiche match du web : système adverse choisi, rapport de force ligne par
// ligne, thème et exercices à travailler avant le match.
export function MatchAnalysis({ matchId, gameFormat, formationId, opponentFormationId }: MatchAnalysisProps) {
  const { apiRequest } = useAuth();
  const [opponent, setOpponent] = useState(opponentFormationId ?? "");
  const [saveError, setSaveError] = useState("");
  const formations = listFormations(gameFormat);
  const known = formations.some((formation) => formation.id === opponent);
  const analysis = known ? analyzeMatchup(gameFormat, formationId, opponent) : null;

  async function chooseOpponent(value: string) {
    setOpponent(value);
    setSaveError("");
    const response = await apiRequest(`/api/matches/${matchId}/details`, { method: "PATCH", body: JSON.stringify({ opponentFormationId: value || null }) });
    if (!response?.ok) {
      setSaveError("Le système adverse n’a pas été enregistré.");
    }
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Analyse de l’adversaire</Text>
      <Text style={styles.hint}>Système de l’adversaire</Text>
      <View style={styles.choices}>
        {formations.map((formation) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: formation.id === opponent }}
            key={formation.id}
            onPress={() => chooseOpponent(formation.id === opponent ? "" : formation.id)}
            style={[styles.choice, formation.id === opponent && styles.choiceActive]}
          >
            <Text style={[styles.choiceText, formation.id === opponent && styles.choiceTextActive]}>{formation.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

      {analysis && (
        <>
          <View accessibilityLabel={`Ton ${formationId} face au ${opponent}`} accessibilityRole="image" style={styles.pitch}>
            <Svg height="100%" viewBox={`0 0 ${pitchWidth} ${pitchHeight}`} width="100%">
              <Rect fill="#152a22" height={pitchHeight - 4} rx={10} stroke="#2c463b" strokeWidth={2} width={pitchWidth - 4} x={2} y={2} />
              <Line stroke="#2c463b" strokeWidth={2} x1={2} x2={pitchWidth - 2} y1={pitchHeight / 2} y2={pitchHeight / 2} />
              {formationSlots(gameFormat, formationId).map((slot) => (
                <Circle cx={slot.x} cy={pitchHeight / 2 + slot.y / 2} fill={colors.primary} key={`o-${slot.id}`} r={10} />
              ))}
              {formationSlots(gameFormat, opponent).map((slot) => (
                <Circle cx={pitchWidth - slot.x} cy={pitchHeight / 2 - slot.y / 2} fill={theirColor} key={`t-${slot.id}`} r={10} />
              ))}
            </Svg>
          </View>
          <View style={styles.legend}>
            <Text style={[styles.legendItem, { color: colors.primary }]}>● Ton équipe</Text>
            <Text style={[styles.legendItem, { color: theirColor }]}>● Adversaire</Text>
          </View>
          <Text style={styles.summary}>{analysis.summary}</Text>
          {analysis.lines.map((line) => (
            <View key={line.id} style={styles.line}>
              <View style={styles.lineHead}>
                <Text style={styles.lineLabel}>{line.label}</Text>
                <Text style={[styles.balance, { color: balanceColors[line.balance] }]}>
                  {line.ours} contre {line.theirs} · {balanceLabels[line.balance]}
                </Text>
              </View>
              <Text style={styles.advice}>{line.advice}</Text>
            </View>
          ))}
          <Text style={styles.themeTitle}>À travailler avant le match : {analysis.theme}</Text>
          {analysis.exercises.map((activity) => (
            <TouchableOpacity accessibilityRole="link" key={activity.id} onPress={() => router.push(`/bibliotheque/${activity.id}`)}>
              <Text style={styles.exercise}>{activity.title} →</Text>
            </TouchableOpacity>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, marginTop: 24, marginBottom: 2 },
  hint: { fontSize: 11, color: colors.muted, marginBottom: 8 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 36, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  choiceActive: { borderColor: theirColor },
  choiceText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  choiceTextActive: { color: theirColor },
  error: { color: colors.danger, fontSize: 12, marginTop: 8 },
  pitch: { width: "70%", alignSelf: "center", aspectRatio: pitchWidth / pitchHeight, marginTop: 16 },
  legend: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8 },
  legendItem: { fontSize: 11, fontWeight: "800" },
  summary: { fontSize: 13, lineHeight: 19, color: colors.ink, marginTop: 12, marginBottom: 6 },
  line: { padding: 12, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, marginTop: 8 },
  lineHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  lineLabel: { fontSize: 12, fontWeight: "800", color: colors.ink },
  balance: { fontSize: 11, fontWeight: "800" },
  advice: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 4 },
  themeTitle: { fontSize: 13, fontWeight: "800", color: colors.ink, marginTop: 16, marginBottom: 4 },
  exercise: { fontSize: 12, fontWeight: "800", color: colors.primary, paddingVertical: 6 },
});
