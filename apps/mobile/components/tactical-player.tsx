import { colors, radii } from "@evolyfoot/design-tokens";
import { buildDiagramAnimation, type AnimationPoint, type DiagramTokenRole, type TacticalDiagram } from "@evolyfoot/domain";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";

// Portage de la lecture animée du web (apps/web/src/app/tactical-player.tsx) : mêmes étapes
// (buildDiagramAnimation), même rythme et mêmes couleurs que le schéma fixe.
const stepSeconds = 1.7;
const pitch = { fill: "#152a22", stroke: "#2c463b" };
const pressColor = "#ff8f7a";
const tokenFill: Record<DiagramTokenRole, string> = { attacker: colors.primary, defender: pressColor, goalkeeper: "#ffffff" };
const labelFill: Record<DiagramTokenRole, string> = { attacker: colors.primaryInk, defender: "#3a140c", goalkeeper: "#152a22" };

function easeInOut(value: number): number {
  return value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2;
}

function mix(from: AnimationPoint, to: AnimationPoint, ratio: number): AnimationPoint {
  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!cancelled) {
        setReduced(value);
      }
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
  return reduced;
}

export function TacticalPlayer({ diagram, seed, label = "Schéma tactique animé" }: { diagram: TacticalDiagram; seed: string; label?: string }) {
  const steps = useMemo(() => buildDiagramAnimation(diagram, seed), [diagram, seed]);
  const reducedMotion = useReducedMotion();
  // `null` tant que l'éducateur n'a touché à rien : la lecture démarre seule, sauf animations réduites.
  const [playChoice, setPlayChoice] = useState<boolean | null>(null);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const speedRef = useRef(speed);
  const playing = playChoice ?? !reducedMotion;

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    let frame = 0;
    let previous: number | null = null;
    const tick = (now: number) => {
      const elapsed = previous === null ? 0 : (now - previous) / 1000;
      previous = now;
      setTime((current) => (current + (elapsed * speedRef.current) / stepSeconds) % steps.length);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, steps.length]);

  const stepIndex = Math.min(Math.floor(time), steps.length - 1);
  const step = steps[stepIndex]!;
  const progress = time - stepIndex;
  const movement = easeInOut(Math.min(progress / 0.85, 1));
  const passing = Math.max(0, Math.min((progress - 0.2) / 0.5, 1));
  const at = (id: string): AnimationPoint => mix(step.from[id]!, step.to[id]!, movement);
  const active = new Set(step.activeIds);

  function goTo(index: number) {
    setPlayChoice(false);
    setTime((index + steps.length) % steps.length);
  }

  return (
    <View style={styles.wrapper}>
      <View
        accessibilityLabel={`${label}, étape ${stepIndex + 1} sur ${steps.length} : ${step.caption}`}
        accessibilityRole="image"
        style={[styles.frame, { aspectRatio: diagram.width / diagram.height }]}
      >
        <Svg height="100%" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 ${diagram.width} ${diagram.height}`} width="100%">
          <Rect fill={pitch.fill} height={diagram.height - 8} rx={14} stroke={pitch.stroke} strokeWidth={2} width={diagram.width - 8} x={4} y={4} />
          {diagram.zones.map((zone, index) => (
            <Rect fill="none" height={zone.height} key={index} rx={8} stroke={pitch.stroke} strokeDasharray="5 5" strokeWidth={1.5} width={zone.width} x={zone.x} y={zone.y} />
          ))}
          {step.pressers.map((press) => {
            const from = at(press.id);
            const to = at(press.targetId);
            return <Line key={`p-${press.id}`} opacity={0.8} stroke={pressColor} strokeDasharray="4 5" strokeWidth={1.4} x1={from.x} x2={to.x} y1={from.y} y2={to.y} />;
          })}
          {step.passes.map((pass) => {
            const from = at(pass.fromId);
            const to = at(pass.toId);
            return <Line key={`l-${pass.fromId}`} opacity={0.75} stroke="#ffffff" strokeDasharray="5 5" strokeWidth={1.6} x1={from.x} x2={to.x} y1={from.y} y2={to.y} />;
          })}
          {diagram.tokens.map((token) => {
            const point = at(token.id);
            return (
              <G key={token.id} opacity={active.has(token.id) ? 1 : 0.5} x={point.x} y={point.y}>
                <Circle fill={tokenFill[token.role]} r={token.role === "goalkeeper" ? 12 : 13} />
                <SvgText fill={labelFill[token.role]} fontSize={9} fontWeight="800" textAnchor="middle" y={4}>
                  {token.label}
                </SvgText>
              </G>
            );
          })}
          {step.pressers.map((press) => {
            const point = at(press.id);
            return <Circle cx={point.x} cy={point.y} fill="none" key={`r-${press.id}`} r={18 + (1 - movement) * 6} stroke={pressColor} strokeWidth={2} />;
          })}
          {step.passes.map((pass) => {
            const holder = at(passing < 1 ? pass.fromId : pass.toId);
            const ball = mix(at(pass.fromId), at(pass.toId), passing);
            return (
              <G key={`b-${pass.fromId}`}>
                <Circle cx={holder.x} cy={holder.y} fill="none" r={18} stroke={colors.lime} strokeWidth={2} />
                <Circle cx={ball.x + 9} cy={ball.y - 9} fill="#ffffff" r={4.5} stroke="#0b131e" strokeWidth={1.2} />
              </G>
            );
          })}
        </Svg>
      </View>

      <View importantForAccessibility="no-hide-descendants" style={styles.progress}>
        {steps.map((_, index) => (
          <View key={index} style={styles.track}>
            <View style={[styles.fill, { width: `${index < stepIndex ? 100 : index === stepIndex ? progress * 100 : 0}%` }]} />
          </View>
        ))}
      </View>
      <Text style={styles.caption}>{step.caption}</Text>
      <View style={styles.controls}>
        <TouchableOpacity accessibilityLabel={`Vitesse ${speed === 1 ? "normale" : "rapide"}, changer`} accessibilityRole="button" onPress={() => setSpeed(speed === 1 ? 2 : 1)} style={styles.control}>
          <Text style={styles.controlText}>{speed}×</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel="Étape précédente" accessibilityRole="button" onPress={() => goTo(stepIndex - 1)} style={styles.control}>
          <Text style={styles.controlText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel={playing ? "Mettre en pause" : "Lire l’animation"} accessibilityRole="button" onPress={() => setPlayChoice(!playing)} style={[styles.control, styles.play]}>
          <Text style={[styles.controlText, styles.playText]}>{playing ? "❚❚" : "▶"}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel="Étape suivante" accessibilityRole="button" onPress={() => goTo(stepIndex + 1)} style={styles.control}>
          <Text style={styles.controlText}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  frame: { width: "100%", borderRadius: radii.sm, overflow: "hidden" },
  progress: { flexDirection: "row", gap: 5, marginTop: 8 },
  track: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: colors.line },
  fill: { height: "100%", backgroundColor: colors.primary },
  caption: { minHeight: 22, marginTop: 8, color: colors.ink, fontSize: 14, fontWeight: "700", textAlign: "center" },
  controls: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 6 },
  control: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  controlText: { fontSize: 16, fontWeight: "800", color: colors.ink },
  play: { width: 52, height: 52, borderRadius: 26, borderColor: colors.primary, backgroundColor: colors.primary },
  playText: { color: colors.primaryInk },
});
