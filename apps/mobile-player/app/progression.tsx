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

// Couleurs des évaluations superposées, de la plus récente à la plus ancienne.
const layerColors = [colors.primary, colors.lime, "#ff9f43", "#c084fc", "#f472b6", "#facc15", "#60a5fa", "#34d399"];

interface RadarLayer {
  id: string;
  scores: PlayerEvaluationScores;
  color: string;
}

// Une seule évaluation : en plein, la précédente en pointillés pour voir ce qui a bougé. Plusieurs :
// chacune avec sa couleur, la plus récente au premier plan.
function Radar({ layers, previous }: { layers: readonly RadarLayer[]; previous: PlayerEvaluationScores | null }) {
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
      {[...layers].reverse().map((layer) => (
        <Polygon
          fill={layer.color}
          fillOpacity={layers.length > 1 ? 0.08 : 0.25}
          key={layer.id}
          points={polygon(layer.scores)}
          stroke={layer.color}
          strokeWidth={2}
        />
      ))}
    </Svg>
  );
}

export default function ProgressionScreen() {
  const { dashboard, status } = useDashboard();

  // Historique complet des notes de l’éducateur, la plus récente d’abord (ordre de l’API).
  const history = dashboard?.evaluations.filter((evaluation) => evaluation.source !== "player") ?? [];
  // Évaluations tracées sur la toile (la dernière par défaut) et fiches dépliées (la dernière par
  // défaut) ; `null` = choix par défaut, tant que le joueur n'a rien touché.
  const [selectedIds, setSelectedIds] = useState<readonly string[] | null>(null);
  const [expandedIds, setExpandedIds] = useState<readonly string[] | null>(null);
  const latestId = history[0]?.id;
  const shownIds = selectedIds ?? (latestId ? [latestId] : []);
  const openIds = expandedIds ?? (latestId ? [latestId] : []);
  const shown = history.filter((evaluation) => shownIds.includes(evaluation.id));
  const layers: RadarLayer[] = shown.map((evaluation) => ({
    id: evaluation.id,
    scores: evaluation.scores,
    color: layerColors[history.indexOf(evaluation) % layerColors.length]!,
  }));
  const single = shown.length === 1 ? shown[0]! : null;
  const previous = single ? (history[history.indexOf(single) + 1] ?? null) : null;
  const allShown = history.length > 0 && shown.length === history.length;

  function toggleShown(id: string) {
    const next = shownIds.includes(id) ? shownIds.filter((value) => value !== id) : [...shownIds, id];
    setSelectedIds(next);
  }

  function toggleOpen(id: string) {
    setExpandedIds(openIds.includes(id) ? openIds.filter((value) => value !== id) : [...openIds, id]);
  }
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

          <Radar layers={layers} previous={previous?.scores ?? null} />
          {history.length === 0 ? (
            <Text style={styles.note}>Pas encore d’évaluation.</Text>
          ) : (
            <>
              <View style={styles.legend}>
                {single ? (
                  <>
                    <Text style={[styles.legendText, { color: layers[0]!.color }]}>{formatDate(single.createdAt)}</Text>
                    {previous ? <Text style={[styles.legendText, { color: colors.lime }]}>Précédente · {formatDate(previous.createdAt)}</Text> : null}
                  </>
                ) : (
                  layers.map((layer) => (
                    <Text key={layer.id} style={[styles.legendText, { color: layer.color }]}>
                      {formatDate(history.find((evaluation) => evaluation.id === layer.id)!.createdAt)}
                    </Text>
                  ))
                )}
              </View>
              {history.length > 1 ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setSelectedIds(allShown ? (latestId ? [latestId] : []) : history.map((evaluation) => evaluation.id))}
                  style={styles.showAll}
                >
                  <Text style={styles.showAllText}>{allShown ? "Revenir à la dernière" : "Afficher toutes les évaluations"}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}

          {history.length > 0 ? (
            <>
              <Text style={styles.section}>Mes évaluations</Text>
              {history.map((evaluation, index) => {
                const before = history[index + 1];
                const delta = before ? Math.round((overall(evaluation.scores) - overall(before.scores)) * 10) / 10 : null;
                const active = shownIds.includes(evaluation.id);
                const open = openIds.includes(evaluation.id);
                const color = layerColors[index % layerColors.length]!;
                return (
                  <View key={evaluation.id} style={[styles.season, active && { borderColor: color }]}>
                    <View style={styles.evaluationHead}>
                      <TouchableOpacity
                        accessibilityLabel={`Afficher sur la toile l’évaluation du ${formatDate(evaluation.createdAt)}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: active }}
                        hitSlop={8}
                        onPress={() => toggleShown(evaluation.id)}
                        style={[styles.check, active && { backgroundColor: color, borderColor: color }]}
                      >
                        {active ? <Text style={styles.checkMark}>✓</Text> : null}
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityLabel={`Évaluation du ${formatDate(evaluation.createdAt)}, ${overall(evaluation.scores)} sur ${playerEvaluationMaxScore}`}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                        onPress={() => toggleOpen(evaluation.id)}
                        style={styles.evaluationToggle}
                      >
                        <Text style={styles.seasonLabel}>{formatDate(evaluation.createdAt)}</Text>
                        <Text style={styles.seasonOverall}>
                          {overall(evaluation.scores).toLocaleString("fr-FR")}/{playerEvaluationMaxScore}
                          {delta === null ? "" : <Text style={delta >= 0 ? styles.up : styles.down}>{`  ${signed(delta)}`}</Text>}
                          <Text style={styles.chevron}>{open ? "  ▾" : "  ▸"}</Text>
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {open ? (
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
                    ) : null}
                  </View>
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
  evaluationHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  evaluationToggle: { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  check: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1.5, borderColor: colors.line },
  checkMark: { color: colors.paper, fontSize: 13, fontWeight: "900" },
  chevron: { color: colors.muted },
  showAll: {
    alignSelf: "center",
    marginTop: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  showAllText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
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
