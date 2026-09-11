"use client";


// Trois graphiques simples, en SVG/CSS pur (même approche que tactical-diagram.tsx) plutôt qu'une
// bibliothèque externe : le besoin (compteurs, une proportion à deux valeurs, une évaluation sur
// quelques axes) ne justifie pas une dépendance de plus.

export interface BarChartDatum {
  readonly label: string;
  readonly value: number;
}

export function BarChart({ data, unit }: { data: readonly BarChartDatum[]; unit?: string }) {
  const max = Math.max(1, ...data.map((datum) => datum.value));
  return (
    <div className="bar-chart" role="img" aria-label={data.map((datum) => `${datum.label} : ${datum.value}${unit ?? ""}`).join(", ")}>
      {data.map((datum) => (
        <div className="bar-chart-column" key={datum.label}>
          <span className="bar-chart-value">{datum.value}</span>
          <div className="bar-chart-track">
            <div className="bar-chart-fill" style={{ height: `${Math.max(4, (datum.value / max) * 100)}%` }} />
          </div>
          <span className="bar-chart-label">{datum.label}</span>
        </div>
      ))}
    </div>
  );
}

export interface DonutSegment {
  readonly label: string;
  readonly value: number;
  readonly tone: "good" | "warn" | "info" | "accent";
}

// Anneau plutôt que camembert plein : le centre reste libre pour afficher le total/taux en
// chiffres, plus lisible qu'une simple proportion visuelle pour ce cas d'usage (présence).
export function DonutChart({ segments, centerLabel, centerValue }: { segments: readonly DonutSegment[]; centerLabel: string; centerValue: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-chart">
      <svg aria-hidden="true" height="150" viewBox="0 0 150 150" width="150">
        <circle className="donut-chart-track" cx="75" cy="75" fill="none" r={radius} strokeWidth="16" />
        {total > 0 &&
          segments.map((segment) => {
            const length = (segment.value / total) * circumference;
            const dashoffset = -offset;
            offset += length;
            return (
              <circle
                className={`donut-chart-segment ${segment.tone}`}
                cx="75"
                cy="75"
                fill="none"
                key={segment.label}
                r={radius}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={dashoffset}
                strokeWidth="16"
                transform="rotate(-90 75 75)"
              />
            );
          })}
      </svg>
      <div className="donut-chart-center">
        <strong>{centerValue}</strong>
        <span>{centerLabel}</span>
      </div>
      <ul className="donut-chart-legend">
        {segments.map((segment) => (
          <li key={segment.label}>
            <span className={`donut-chart-dot ${segment.tone}`} />
            {segment.label} · {segment.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface RadarAxis {
  readonly key: string;
  readonly label: string;
}

// Une évaluation superposée sur le radar, sa propre couleur -- voir player-detail-view.tsx, qui
// permet de comparer plusieurs évaluations datées d'un même joueur sur un seul graphe.
export interface RadarSeries {
  readonly key: string;
  readonly label: string;
  readonly color: string;
  readonly scores: Readonly<Record<string, number>>;
}

export function RadarChart({
  axes,
  scores,
  series,
  min,
  max,
  size = 260,
}: {
  axes: readonly RadarAxis[];
  // Une seule évaluation (usage historique, ex. tableau de bord joueur) -- ignoré si `series` est
  // fourni.
  scores?: Readonly<Record<string, number>>;
  // Plusieurs évaluations superposées, chacune avec sa couleur -- voir RadarSeries ci-dessus.
  series?: ReadonlyArray<RadarSeries>;
  min: number;
  max: number;
  // Côté du SVG en pixels (carré). 260 par défaut ; un usage plus proéminent (comparaison
  // d'évaluations) peut demander un graphe plus grand.
  size?: number;
}) {
  const center = size / 2;
  const radius = size * 0.34;
  // Au plus 5 anneaux, quelle que soit l'amplitude (0-10 tracerait 10 anneaux, illisible).
  const ringCount = Math.min(Math.max(max - min, 1), 5);
  const angleStep = (2 * Math.PI) / axes.length;

  function pointAt(index: number, ratio: number): { x: number; y: number } {
    const angle = index * angleStep - Math.PI / 2;
    return { x: center + Math.cos(angle) * radius * ratio, y: center + Math.sin(angle) * radius * ratio };
  }

  const effectiveSeries: ReadonlyArray<RadarSeries> = series ?? (scores ? [{ key: "default", label: "", color: "var(--accent)", scores }] : []);

  function seriesPoints(values: Readonly<Record<string, number>>) {
    return axes.map((axis, index) => {
      const score = values[axis.key] ?? min;
      const ratio = (score - min) / (max - min);
      return pointAt(index, ratio);
    });
  }

  return (
    <div className="radar-chart">
      <svg
        aria-label={effectiveSeries
          .map((entry) => `${entry.label ? `${entry.label} : ` : ""}${axes.map((axis) => `${axis.label} ${entry.scores[axis.key] ?? min}/${max}`).join(", ")}`)
          .join(" · ")}
        height={size}
        role="img"
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        {Array.from({ length: ringCount + 1 }, (_, ring) => ring / ringCount).map((ratio) => (
          <polygon
            className="radar-chart-ring"
            key={ratio}
            points={axes.map((_, index) => `${pointAt(index, ratio).x},${pointAt(index, ratio).y}`).join(" ")}
          />
        ))}
        {axes.map((axis, index) => {
          const outer = pointAt(index, 1);
          return <line className="radar-chart-axis" key={axis.key} x1={center} x2={outer.x} y1={center} y2={outer.y} />;
        })}
        {effectiveSeries.map((entry) => {
          const dataPoints = seriesPoints(entry.scores);
          const dataPath = dataPoints.map((point) => `${point.x},${point.y}`).join(" ");
          return (
            <g key={entry.key}>
              <polygon className="radar-chart-data" fill={entry.color} fillOpacity="0.22" points={dataPath} stroke={entry.color} strokeWidth="2" />
              {dataPoints.map((point, index) => (
                <circle cx={point.x} cy={point.y} fill={entry.color} key={axes[index]!.key} r="3.5" />
              ))}
            </g>
          );
        })}
        {axes.map((axis, index) => {
          const labelPoint = pointAt(index, 1.24);
          return (
            <text className="radar-chart-label" key={axis.key} textAnchor="middle" x={labelPoint.x} y={labelPoint.y}>
              {axis.label}
            </text>
          );
        })}
      </svg>
      {series && series.length > 0 && (
        <ul className="radar-chart-legend">
          {series.map((entry) => (
            <li key={entry.key}>
              <span className="radar-chart-legend-dot" style={{ background: entry.color }} />
              {entry.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
