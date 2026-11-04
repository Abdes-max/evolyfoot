import { colors, radii } from "@evolyfoot/design-tokens";
import type { DiagramTarget, DiagramTokenRole, TacticalDiagram } from "@evolyfoot/domain";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Marker, Path, Rect, Text as SvgText } from "react-native-svg";
import { DiagramTargetShape } from "./diagram-target";

// Mêmes couleurs que le schéma du web (apps/web/src/app/tactical-diagram.css).
const pitch = { fill: "#152a22", stroke: "#2c463b" };
const tokenFill: Record<DiagramTokenRole, string> = { attacker: colors.primary, defender: "#ff8f7a", goalkeeper: "#ffffff" };
const labelFill: Record<DiagramTokenRole, string> = { attacker: colors.primaryInk, defender: "#3a140c", goalkeeper: "#152a22" };
const tokenRadius: Record<DiagramTokenRole, number> = { attacker: 13, defender: 13, goalkeeper: 12 };

// `targets` : buts, portes et lignes de l'exercice (diagramTargets).
export function TacticalDiagramView({
  diagram,
  label = "Schéma tactique",
  targets = [],
}: {
  diagram: TacticalDiagram;
  label?: string;
  targets?: readonly DiagramTarget[];
}) {
  return (
    <View accessibilityLabel={label} accessibilityRole="image" style={[styles.frame, { aspectRatio: diagram.width / diagram.height }]}>
      <Svg height="100%" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 ${diagram.width} ${diagram.height}`} width="100%">
        <Defs>
          <Marker id="arrowhead" markerHeight={8} markerWidth={8} orient="auto" refX={4} refY={4}>
            <Path d="M0,0 L8,4 L0,8 Z" fill={colors.primary} />
          </Marker>
        </Defs>
        <Rect fill={pitch.fill} height={diagram.height - 8} rx={14} stroke={pitch.stroke} strokeWidth={2} width={diagram.width - 8} x={4} y={4} />
        {diagram.marks?.map((mark, index) => (
          <Rect fill="#5b8def" fillOpacity={0.22} height={mark.height} key={`m-${index}`} rx={4} width={mark.width} x={mark.x} y={mark.y} />
        ))}
        {diagram.zones.map((zone, index) => (
          <Rect
            fill="none"
            height={zone.height}
            key={index}
            rx={8}
            stroke={pitch.stroke}
            strokeDasharray="5 5"
            strokeWidth={1.5}
            width={zone.width}
            x={zone.x}
            y={zone.y}
          />
        ))}
        {targets.map((target, index) => (
          <DiagramTargetShape key={`t-${index}`} target={target} />
        ))}
        {diagram.arrows.map((arrow, index) => (
          <Path
            d={`M${arrow.x1} ${arrow.y1} L${arrow.x2} ${arrow.y2}`}
            fill="none"
            key={index}
            markerEnd="url(#arrowhead)"
            stroke={colors.primary}
            strokeWidth={2.2}
          />
        ))}
        {diagram.tokens.map((token) => (
          <Circle cx={token.x} cy={token.y} fill={tokenFill[token.role]} key={`c-${token.id}`} r={tokenRadius[token.role]} />
        ))}
        {diagram.tokens.map((token) => (
          <SvgText fill={labelFill[token.role]} fontSize={9} fontWeight="800" key={`t-${token.id}`} textAnchor="middle" x={token.x} y={token.y + 4}>
            {token.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", borderRadius: radii.sm, overflow: "hidden", marginBottom: 12 },
});
