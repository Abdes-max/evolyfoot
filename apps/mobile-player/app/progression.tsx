import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import {
  buildPlayerEvaluationSeasons,
  playerEvaluationAspectLabels,
  playerEvaluationAspects,
  playerEvaluationMaxScore,
  type PlayerEvaluationScores,
} from "@evolyfoot/domain";
import { Fragment, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import { Screen } from "../components/screen";
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

function overall(scores: PlayerEvaluationScores): number {
  return Math.round((playerEvaluationAspects.reduce((sum, aspect) => sum + scores[aspect], 0) / playerEvaluationAspects.length) * 10) / 10;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("fr-FR")}`;
}

// L’évaluation choisie en plein, la précédente en pointillés pour voir ce qui a bougé.
function Radar({ coach, previous }: { coach: PlayerEvaluationScores | null; previous: PlayerEvaluationScores | null }) {
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
      {previous ? <Polygon fill="none" points={polygon(previous)} stroke={colors.lime} strokeDasharray="5 4" strokeWidth={1.5} /> : null}
      {coach ? <Polygon fill={colors.primary} fillOpacity={0.25} points={polygon(coach)} stroke={colors.primary} strokeWidth={2} /> : null}
    </Svg>
  );
}

export default function ProgressionScreen() {
  const { dashboard, status } = useDashboard();

  // Historique complet des notes de l’éducateur, la plus récente d’abord (ordre de l’API).
  const history = dashboard?.evaluations.filter((evaluation) => evaluation.source !== "player") ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIndex = Math.max(
    0,
    history.findIndex((evaluation) => evaluation.id === selectedId),
  );
  const selected = history[selectedIndex] ?? null;
  const previous = history[selectedIndex + 1] ?? null;
  const coach = selected?.scores ?? null;
  const seasons = buildPlayerEvaluationSeasons(dashboard?.evaluations ?? []);

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

          <Radar coach={coach} previous={previous?.scores ?? null} />
          {selected ? (
            <View style={styles.legend}>
              <Text style={[styles.legendText, { color: colors.primary }]}>{formatDate(selected.createdAt)}</Text>
              {previous ? <Text style={[styles.legendText, { color: colors.lime }]}>Précédente · {formatDate(previous.createdAt)}</Text> : null}
            </View>
          ) : (
            <Text style={styles.note}>Pas encore d’évaluation.</Text>
          )}

          {history.length > 0 ? (
            <>
              <Text style={styles.section}>Mes évaluations</Text>
              {history.map((evaluation, index) => {
                const before = history[index + 1];
                const delta = before ? Math.round((overall(evaluation.scores) - overall(before.scores)) * 10) / 10 : null;
                const active = index === selectedIndex;
                return (
                  <TouchableOpacity
                    accessibilityLabel={`Évaluation du ${formatDate(evaluation.createdAt)}, ${overall(evaluation.scores)} sur ${playerEvaluationMaxScore}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    key={evaluation.id}
                    onPress={() => setSelectedId(evaluation.id)}
                    style={[styles.season, active && styles.evaluationActive]}
                  >
                    <View style={styles.seasonHead}>
                      <Text style={styles.seasonLabel}>{formatDate(evaluation.createdAt)}</Text>
                      <Text style={styles.seasonOverall}>
                        {overall(evaluation.scores).toLocaleString("fr-FR")}/{playerEvaluationMaxScore}
                        {delta === null ? "" : <Text style={delta >= 0 ? styles.up : styles.down}>{`  ${signed(delta)}`}</Text>}
                      </Text>
                    </View>
                    <View style={styles.chips}>
                      {playerEvaluationAspects.map((aspect) => {
                        const change = before ? evaluation.scores[aspect] - before.scores[aspect] : 0;
                        return (
                          <Text key={aspect} style={styles.chip}>
                            {playerEvaluationAspectLabels[aspect]} {evaluation.scores[aspect]}
                            {change !== 0 ? <Text style={change > 0 ? styles.up : styles.down}>{` ${change > 0 ? "▲" : "▼"}`}</Text> : null}
                          </Text>
                        );
                      })}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : null}

          {seasons.length > 0 ? (
            <>
              <Text style={styles.section}>Mes saisons</Text>
              {seasons.map((season) => (
                <View key={season.startYear} style={styles.season}>
                  <View style={styles.seasonHead}>
                    <Text style={styles.seasonLabel}>{season.label}</Text>
                    <Text style={styles.seasonOverall}>
                      {season.overall.toLocaleString("fr-FR")}/{playerEvaluationMaxScore}
                      {season.deltaFromPrevious === null ? (
                        ""
                      ) : (
                        <Text style={season.deltaFromPrevious >= 0 ? styles.up : styles.down}>
                          {`  ${season.deltaFromPrevious > 0 ? "+" : ""}${season.deltaFromPrevious.toLocaleString("fr-FR")}`}
                        </Text>
                      )}
                    </Text>
                  </View>
                  {playerEvaluationAspects.map((aspect) => (
                    <View key={aspect} style={styles.barRow}>
                      <Text style={styles.barLabel}>{playerEvaluationAspectLabels[aspect]}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${(season.averages[aspect] / playerEvaluationMaxScore) * 100}%` }]} />
                      </View>
                      <Text style={styles.barValue}>{season.averages[aspect].toLocaleString("fr-FR")}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: spacing.sm },
  counters: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  counter: {
    flex: 1,
    padding: spacing.md,
    alignItems: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
  },
  counterValue: { color: colors.lime, fontSize: 28, fontWeight: "900" },
  counterLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  radar: { alignSelf: "center" },
  legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.md },
  evaluationActive: { borderColor: colors.primary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.paper,
    overflow: "hidden",
  },
  legendText: { fontSize: 12, fontWeight: "800" },
  season: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
  },
  seasonHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  seasonLabel: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  seasonOverall: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  up: { color: colors.lime },
  down: { color: colors.danger },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
  barLabel: { width: 74, color: colors.muted, fontSize: 11, fontWeight: "700" },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, backgroundColor: colors.primary },
  barValue: { width: 30, color: colors.ink, fontSize: 11, fontWeight: "800", textAlign: "right" },
  section: { color: colors.ink, fontSize: 22, fontWeight: "900", textTransform: "uppercase", marginTop: spacing.lg, marginBottom: spacing.sm },
});
