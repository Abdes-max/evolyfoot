// Terrain animé du hero : le ballon circule entre trois joueurs pendant que le pressing se
// resserre. Dessin purement décoratif, sa description est portée par le texte voisin.
const teammates = [
  { x: 70, y: 250, label: "2" },
  { x: 170, y: 120, label: "6" },
  { x: 250, y: 300, label: "8" },
  { x: 330, y: 170, label: "10" },
];

export function HeroPitch() {
  return (
    <svg aria-hidden="true" className="m-pitch" viewBox="0 0 400 420">
      <defs>
        <linearGradient id="m-pitch-grass" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0f3b2f" />
          <stop offset="1" stopColor="#0a2230" />
        </linearGradient>
      </defs>
      <rect fill="url(#m-pitch-grass)" height="420" rx="22" width="400" />
      <g className="m-pitch-lines">
        <rect height="388" rx="8" width="368" x="16" y="16" />
        <path d="M16 210h368" />
        <circle cx="200" cy="210" r="52" />
        <rect height="62" width="170" x="115" y="16" />
        <rect height="62" width="170" x="115" y="342" />
      </g>
      <path className="m-pitch-run" d="M70 250 L170 120 L330 170" />
      <g className="m-pitch-press">
        <circle cx="255" cy="110" fill="#ffb073" r="13" />
        <circle cx="290" cy="245" fill="#ffb073" r="13" />
      </g>
      {teammates.map((player) => (
        <g className="m-pitch-player" key={player.label}>
          <circle cx={player.x} cy={player.y} fill="#2fd4ff" r="15" />
          <text x={player.x} y={player.y + 4}>
            {player.label}
          </text>
        </g>
      ))}
      <circle className="m-pitch-ball" cx="70" cy="250" fill="#c6ff3d" r="7" />
    </svg>
  );
}
