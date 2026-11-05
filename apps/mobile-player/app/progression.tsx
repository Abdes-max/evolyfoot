import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import {
  buildPlayerEvaluationSeasons,
  playerEvaluationAspectLabels,
  playerEvaluationAspects,
  playerEvaluationMaxScore,
  type PlayerEvaluationScores,
} from "@evolyfoot/domain";
import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
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

function Radar({ coach }: { coach: PlayerEvaluationScores | null }) {
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
    </Svg>
  );
}

export default function ProgressionScreen() {
  const { dashboard, status } = useDashboard();

  const coach = dashboard?.evaluations.find((evaluation) => evaluation.source !== "player")?.scores ?? null;
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

          <Radar coach={coach} />
          {coach ? (
            <View style={styles.legend}>
              <Text style={[styles.legendText, { color: colors.primary }]}>Éducateur</Text>
            </View>
          ) : (
            <Text style={styles.note}>Pas encore d’évaluation.</Text>
          )}

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
  legend: { flexDirection: "row", justifyContent: "center", gap: spacing.md },
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
