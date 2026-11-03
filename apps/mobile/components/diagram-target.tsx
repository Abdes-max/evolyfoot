import { colors } from "@evolyfoot/design-tokens";
import { targetGeometry, type AnimationPoint, type DiagramTarget } from "@evolyfoot/domain";
import { Ellipse, G, Line, Polygon, Polyline } from "react-native-svg";

// Mêmes couleurs que le web (apps/web/src/app/exercise-sheet.css).
const coneFill = "#ff8a1f";
const plotFill = "#ffd23f";
const markerStroke = "#3a2600";

function Cone({ at }: { at: AnimationPoint }) {
  return <Polygon fill={coneFill} points={`${at.x},${at.y - 6} ${at.x - 5},${at.y + 4} ${at.x + 5},${at.y + 4}`} stroke={markerStroke} strokeWidth={1} />;
}

// But et mini-but ouverts vers le terrain, porte en deux cônes, ligne à franchir en pointillés,
// cône (triangle) ou plot (coupelle plate) -- communs au schéma fixe (tactical-diagram.tsx) et à
// l'animation (tactical-player.tsx).
export function DiagramTargetShape({ target }: { target: DiagramTarget }) {
  const { a, b, backA, backB } = targetGeometry(target);
  if (target.kind === "cone") {
    return <Cone at={target.center} />;
  }
  if (target.kind === "plot") {
    return <Ellipse cx={target.center.x} cy={target.center.y} fill={plotFill} rx={5} ry={3} stroke={markerStroke} strokeWidth={1} />;
  }
  if (target.kind === "gate") {
    return (
      <G>
        <Cone at={a} />
        <Cone at={b} />
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
