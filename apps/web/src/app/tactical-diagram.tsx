"use client";

import type { TacticalDiagram } from "@evolyfoot/domain";
import { useId } from "react";

interface TacticalDiagramViewProps {
  diagram: TacticalDiagram;
  caption?: string;
}

const tokenRadius: Record<string, number> = { attacker: 13, defender: 13, goalkeeper: 12 };

export function TacticalDiagramView({ diagram, caption }: TacticalDiagramViewProps) {
  const arrowheadId = `tactical-diagram-arrowhead-${useId()}`;

  return (
    <div className="tactical-diagram">
      {caption && <div className="tactical-diagram-caption">{caption}</div>}
      <svg
        aria-label={caption ? `Schéma tactique : ${caption}` : "Schéma tactique"}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${diagram.width} ${diagram.height}`}
      >
        <defs>
          <marker id={arrowheadId} markerHeight="8" markerWidth="8" orient="auto" refX="4" refY="4">
            <path className="tactical-diagram-arrowhead" d="M0,0 L8,4 L0,8 Z" />
          </marker>
        </defs>
        <rect className="tactical-diagram-pitch" height={diagram.height - 8} rx="14" width={diagram.width - 8} x="4" y="4" />
        {diagram.zones.map((zone, index) => (
          <rect className="tactical-diagram-zone" height={zone.height} key={index} rx="8" width={zone.width} x={zone.x} y={zone.y} />
        ))}
        {diagram.arrows.map((arrow, index) => (
          <path
            className="tactical-diagram-arrow"
            d={`M${arrow.x1} ${arrow.y1} L${arrow.x2} ${arrow.y2}`}
            key={index}
            markerEnd={`url(#${arrowheadId})`}
          />
        ))}
        {diagram.tokens.map((token) => (
          <g key={token.id}>
            <circle className={`tactical-diagram-token ${token.role}`} cx={token.x} cy={token.y} r={tokenRadius[token.role]} />
            <text className={`tactical-diagram-label ${token.role}`} textAnchor="middle" x={token.x} y={token.y + 4}>
              {token.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
