import { colors } from "@evolyfoot/design-tokens";
import { playerEvaluationAspectLabels, playerEvaluationAspects, playerEvaluationMaxScore, type PlayerEvaluationScores } from "@evolyfoot/domain";
import { Fragment } from "react";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";

// Même toile que l'onglet Progression d'EvolyFoot Player.
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

export function EvaluationRadar({ coach, self }: { coach: PlayerEvaluationScores | null; self: PlayerEvaluationScores | null }) {
  return (
    <Svg accessibilityLabel="Toile d’évaluation" height={RADAR_SIZE} style={{ alignSelf: "center" }} width={RADAR_SIZE}>
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
