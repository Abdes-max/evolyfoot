import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import {
  playerEvaluationAspectLabels,
  playerEvaluationAspects,
  playerEvaluationMaxScore,
  playerEvaluationMinScore,
  type PlayerEvaluationScores,
} from "@evolyfoot/domain";
import { Fragment, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import { Screen } from "../components/screen";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useDashboard } from "../lib/dashboard";

const RADAR_SIZE = 300;
const CENTER = RADAR_SIZE / 2;
const RADIUS = 104;

function point(index: number, ratio: number): [number, number] {
  const angle = (index / playerEvaluationAspects.length) * 2 * Math.PI - Math.PI / 2;
  return [CENTER + Math.cos(angle) * RADIUS * ratio, CENTER + Math.sin(angle) * RADIUS * ratio];
}

function polygon(scores: PlayerEvaluationScores): string {
  return playerEvaluationAspects.map((aspect, index) => point(index, scores[aspect] / playerEvaluationMaxScore).join(",")).join(" ");
}

function midpointScores(): PlayerEvaluationScores {
  const midpoint = Math.round((playerEvaluationMinScore + playerEvaluationMaxScore) / 2);
  return Object.fromEntries(playerEvaluationAspects.map((aspect) => [aspect, midpoint])) as PlayerEvaluationScores;
}

function Radar({ coach, self }: { coach: PlayerEvaluationScores | null; self: PlayerEvaluationScores | null }) {
  return (
    <Svg accessibilityLabel="Toile d’évaluation" height={RADAR_SIZE} style={styles.radar} width={RADAR_SIZE}>
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <Circle cx={CENTER} cy={CENTER} fill="none" key={ratio} r={RADIUS * ratio} stroke={colors.line} />
      ))}
      {playerEvaluationAspects.map((aspect, index) => {
        const [x, y] = point(index, 1);
        const [labelX, labelY] = point(index, 1.2);
        return (
          <Fragment key={aspect}>
            <Line stroke={colors.line} x1={CENTER} x2={x} y1={CENTER} y2={y} />
            <SvgText fill={colors.muted} fontSize={11} fontWeight="700" textAnchor="middle" x={labelX} y={labelY + 4}>
              {playerEvaluationAspectLabels[aspect]}
            </SvgText>
          </Fragment>
        );
      })}
      {coach ? <Polygon fill={colors.primary} fillOpacity={0.25} points={polygon(coach)} stroke={colors.primary} strokeWidth={2} /> : null}
      {self ? <Polygon fill={colors.lime} fillOpacity={0.15} points={polygon(self)} stroke={colors.lime} strokeWidth={2} /> : null}
    </Svg>
  );
}

export default function ProgressionScreen() {
  const { sessionToken } = useAuth();
  const { dashboard, status, reload } = useDashboard();
  const [scores, setScores] = useState<PlayerEvaluationScores>(midpointScores);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const coach = dashboard?.evaluations.find((evaluation) => evaluation.source !== "player")?.scores ?? null;
  const self = dashboard?.evaluations.find((evaluation) => evaluation.source === "player")?.scores ?? null;

  function adjust(aspect: keyof PlayerEvaluationScores, delta: number) {
    setFeedback("");
    setScores((current) => ({
      ...current,
      [aspect]: Math.min(playerEvaluationMaxScore, Math.max(playerEvaluationMinScore, current[aspect] + delta)),
    }));
  }

  async function save() {
    setSaving(true);
    setFeedback("");
    const response = await apiFetch("/api/joueur/auto-evaluation", {
      method: "POST",
      sessionToken,
      body: JSON.stringify({ scores }),
    }).catch(() => null);
    setSaving(false);
    if (!response?.ok) {
      setFeedback("Ton auto-évaluation n’a pas été enregistrée, réessaie.");
      return;
    }
    setFeedback("Auto-évaluation enregistrée.");
    await reload();
  }

  return (
    <Screen title="Mes progrès">
      {status === "error" && !dashboard ? <Text style={styles.note}>Impossible de charger tes progrès.</Text> : null}
      {dashboard ? (
        <>
          <View style={styles.counters}>
            <View style={styles.counter}>
              <Text style={styles.counterValue}>{dashboard.trainingAttendance.rate}%</Text>
              <Text style={styles.counterLabel}>Entraînements</Text>
            </View>
            <View style={styles.counter}>
              <Text style={styles.counterValue}>{dashboard.matchAttendance.rate}%</Text>
              <Text style={styles.counterLabel}>Matchs</Text>
            </View>
          </View>

          <Radar coach={coach} self={self} />
          {coach || self ? (
            <View style={styles.legend}>
              {coach ? <Text style={[styles.legendText, { color: colors.primary }]}>Éducateur</Text> : null}
              {self ? <Text style={[styles.legendText, { color: colors.lime }]}>Moi</Text> : null}
            </View>
          ) : (
            <Text style={styles.note}>Pas encore d’évaluation.</Text>
          )}

          <Text style={styles.section}>Je m’évalue</Text>
          {playerEvaluationAspects.map((aspect) => (
            <View key={aspect} style={styles.row}>
              <Text style={styles.rowLabel}>{playerEvaluationAspectLabels[aspect]}</Text>
              <TouchableOpacity accessibilityLabel={`Baisser ${playerEvaluationAspectLabels[aspect]}`} onPress={() => adjust(aspect, -1)} style={styles.step}>
                <Text style={styles.stepText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.rowValue}>{scores[aspect]}</Text>
              <TouchableOpacity accessibilityLabel={`Monter ${playerEvaluationAspectLabels[aspect]}`} onPress={() => adjust(aspect, 1)} style={styles.step}>
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          ))}
          {feedback ? <Text style={styles.note}>{feedback}</Text> : null}
          <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={save} style={styles.save}>
            <Text style={styles.saveText}>{saving ? "Enregistrement…" : "Enregistrer"}</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: spacing.sm },
  counters: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  counter: { flex: 1, padding: spacing.md, alignItems: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.primaryDark, backgroundColor: colors.surface },
  counterValue: { color: colors.lime, fontSize: 28, fontWeight: "900" },
  counterLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  radar: { alignSelf: "center" },
  legend: { flexDirection: "row", justifyContent: "center", gap: spacing.md },
  legendText: { fontSize: 12, fontWeight: "800" },
  section: { color: colors.ink, fontSize: 22, fontWeight: "900", textTransform: "uppercase", marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  rowLabel: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "700" },
  rowValue: { width: 28, color: colors.lime, fontSize: 18, fontWeight: "900", textAlign: "center" },
  step: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  stepText: { color: colors.primary, fontSize: 22, fontWeight: "800" },
  save: { minHeight: 48, marginTop: spacing.md, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
  saveText: { color: colors.primaryInk, fontSize: 14, fontWeight: "900" },
});
