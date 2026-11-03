import { targetGeometry, type AnimationPoint, type DiagramTarget } from "@evolyfoot/domain";

function Cone({ at }: { at: AnimationPoint }) {
  return <polygon className="tactical-target-cone" points={`${at.x},${at.y - 6} ${at.x - 5},${at.y + 4} ${at.x + 5},${at.y + 4}`} />;
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
    return <ellipse className="tactical-target-plot" cx={target.center.x} cy={target.center.y} rx="5" ry="3" />;
  }
  if (target.kind === "gate") {
    return (
      <g>
        <Cone at={a} />
        <Cone at={b} />
      </g>
    );
  }
  if (target.kind === "line") {
    return <line className="tactical-target-line" x1={a.x} x2={b.x} y1={a.y} y2={b.y} />;
  }
  return <polyline className={`tactical-target-goal ${target.kind}`} points={`${a.x},${a.y} ${backA.x},${backA.y} ${backB.x},${backB.y} ${b.x},${b.y}`} />;
}
