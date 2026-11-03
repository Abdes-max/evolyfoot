import { colors } from "@evolyfoot/design-tokens";
import { targetGeometry, type DiagramTarget } from "@evolyfoot/domain";
import { Circle, G, Line, Polyline } from "react-native-svg";

// But et mini-but ouverts vers le terrain, porte en deux plots, ligne à franchir en pointillés --
// communs au schéma fixe (tactical-diagram.tsx) et à l'animation (tactical-player.tsx).
export function DiagramTargetShape({ target }: { target: DiagramTarget }) {
  const { a, b, backA, backB } = targetGeometry(target);
  if (target.kind === "gate") {
    return (
      <G>
        <Circle cx={a.x} cy={a.y} fill="#ffb347" r={4} stroke="#3a2600" strokeWidth={1} />
        <Circle cx={b.x} cy={b.y} fill="#ffb347" r={4} stroke="#3a2600" strokeWidth={1} />
      </G>
    );
  }
  if (target.kind === "line") {
    return <Line opacity={0.8} stroke={colors.lime} strokeDasharray="6 4" strokeWidth={2} x1={a.x} x2={b.x} y1={a.y} y2={b.y} />;
  }
  return (
    <Polyline
      fill="rgba(255,255,255,0.14)"
      points={`${a.x},${a.y} ${backA.x},${backA.y} ${backB.x},${backB.y} ${b.x},${b.y}`}
      stroke="#ffffff"
      strokeLinejoin="round"
      strokeWidth={target.kind === "goal" ? 2.5 : 2}
    />
  );
}
