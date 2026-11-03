import { targetGeometry, type DiagramTarget } from "@evolyfoot/domain";

// But et mini-but ouverts vers le terrain, porte en deux plots, ligne à franchir en pointillés --
// communs au schéma fixe (tactical-diagram.tsx) et à l'animation (tactical-player.tsx).
export function DiagramTargetShape({ target }: { target: DiagramTarget }) {
  const { a, b, backA, backB } = targetGeometry(target);
  if (target.kind === "gate") {
    return (
      <g className="tactical-target-gate">
        <circle cx={a.x} cy={a.y} r="4" />
        <circle cx={b.x} cy={b.y} r="4" />
      </g>
    );
  }
  if (target.kind === "line") {
    return <line className="tactical-target-line" x1={a.x} x2={b.x} y1={a.y} y2={b.y} />;
  }
  return <polyline className={`tactical-target-goal ${target.kind}`} points={`${a.x},${a.y} ${backA.x},${backA.y} ${backB.x},${backB.y} ${b.x},${b.y}`} />;
}
