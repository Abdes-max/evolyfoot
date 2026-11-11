import { getTheme } from "@evolyfoot/design-tokens";
import { StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

// Fonds des cartes de l'accueil, repris de la vue d'ensemble du web (globals.css et
// design-impact.css) : à poser en premier enfant d'une carte en `overflow: "hidden"`.
interface Variant {
  from: string;
  via?: string;
  to: string;
  glow: string | null;
  glowOpacity: number;
  cx: string;
  cy: string;
}
type VariantName = "primary" | "focus" | "match" | "page" | "button";

const darkVariants: Record<VariantName, Variant> = {
  // .session-card.home-primary : grande carte cyan de la prochaine séance, reflet blanc en haut à gauche.
  primary: { from: "#7fdcff", via: "#2fd4ff", to: "#1aa7d8", glow: "#ffffff", glowOpacity: 0.35, cx: "0%", cy: "0%" },
  // .focus-card : dégradé bleu nuit et halo citron en haut à droite.
  focus: { from: "#123349", to: "#0c1a26", glow: "#c6ff3d", glowOpacity: 0.12, cx: "100%", cy: "0%" },
  // .home-match : halo cyan au centre, sur le fond des cartes.
  match: { from: "#101722", to: "#101722", glow: "#3ec6f5", glowOpacity: 0.1, cx: "50%", cy: "50%" },
  // Fond de page (body) : halo cyan en haut à droite.
  page: { from: "#070b12", to: "#070b12", glow: "#2fd4ff", glowOpacity: 0.1, cx: "85%", cy: "0%" },
  // .continue-button : dégradé cyan.
  button: { from: "#2fd4ff", to: "#86e8ff", glow: null, glowOpacity: 0, cx: "0%", cy: "0%" },
};

// Thème clair : fonds clairs pour la page et les cartes, carte principale en bleu plus profond (texte blanc lisible).
const lightVariants: Record<VariantName, Variant> = {
  primary: { from: "#35b8e6", via: "#0b86b8", to: "#086a93", glow: "#ffffff", glowOpacity: 0.3, cx: "0%", cy: "0%" },
  focus: { from: "#d9ebf6", to: "#eaf4fb", glow: "#4d7c0f", glowOpacity: 0.1, cx: "100%", cy: "0%" },
  match: { from: "#ffffff", to: "#ffffff", glow: "#0b86b8", glowOpacity: 0.08, cx: "50%", cy: "50%" },
  page: { from: "#f3f6fa", to: "#f3f6fa", glow: "#0b86b8", glowOpacity: 0.08, cx: "85%", cy: "0%" },
  button: { from: "#0b86b8", to: "#35b8e6", glow: null, glowOpacity: 0, cx: "0%", cy: "0%" },
};

export function CardGlow({ variant }: { variant: VariantName }) {
  const variants = getTheme() === "light" ? lightVariants : darkVariants;
  const { from, to, glow, glowOpacity, cx, cy } = variants[variant];
  const via = variants[variant].via ?? null;
  const id = `glow-${variant}`;
  return (
    <Svg pointerEvents="none" preserveAspectRatio="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={`${id}-base`} x1="0" x2="1" y1="0" y2="1">
          {(via
            ? [
                [0, from],
                [0.55, via],
                [1, to],
              ]
            : [
                [0, from],
                [1, to],
              ]
          ).map(([offset, color]) => (
            <Stop key={offset} offset={offset} stopColor={color as string} />
          ))}
        </LinearGradient>
        {glow ? (
          <RadialGradient cx={cx} cy={cy} id={`${id}-halo`} r="70%">
            <Stop offset="0" stopColor={glow} stopOpacity={glowOpacity} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        ) : null}
      </Defs>
      <Rect fill={`url(#${id}-base)`} height="100" width="100" />
      {glow ? <Rect fill={`url(#${id}-halo)`} height="100" width="100" /> : null}
    </Svg>
  );
}
