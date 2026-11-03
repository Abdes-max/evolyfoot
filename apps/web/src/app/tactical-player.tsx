"use client";

import { ballFrame, buildDiagramAnimation, diagramTargets, type AnimatedExercise, type AnimationPoint } from "@evolyfoot/domain";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DiagramTargetShape } from "./diagram-target";

const stepSeconds = 1.7;
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToMotion(onChange: () => void): () => void {
  const query = window.matchMedia?.(reducedMotionQuery);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

// Côté serveur, l'animation reste à l'arrêt : le navigateur la lance à l'affichage.
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia?.(reducedMotionQuery).matches ?? false,
    () => true,
  );
}

function easeInOut(value: number): number {
  return value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2;
}

function mix(from: AnimationPoint, to: AnimationPoint, ratio: number): AnimationPoint {
  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
}

export function TacticalPlayer({ exercise, seed }: { exercise: AnimatedExercise; seed: string }) {
  const { diagram } = exercise;
  const steps = useMemo(() => buildDiagramAnimation(exercise, seed), [exercise, seed]);
  const targets = useMemo(() => diagramTargets(exercise), [exercise]);
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
    <div className="tactical-player">
      <div className="tactical-diagram">
        <svg
          aria-label={`Schéma tactique animé, étape ${stepIndex + 1} : ${step.caption}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          viewBox={`0 0 ${diagram.width} ${diagram.height}`}
        >
          <rect className="tactical-diagram-pitch" height={diagram.height - 8} rx="14" width={diagram.width - 8} x="4" y="4" />
          {diagram.zones.map((zone, index) => (
            <rect className="tactical-diagram-zone" height={zone.height} key={index} rx="8" width={zone.width} x={zone.x} y={zone.y} />
          ))}
          {targets.map((target, index) => (
            <DiagramTargetShape key={index} target={target} />
          ))}
          {step.pressers.map((press) => {
            const from = at(press.id);
            const to = at(press.targetId);
            return <line className="tactical-player-press" key={press.id} x1={from.x} x2={to.x} y1={from.y} y2={to.y} />;
          })}
          {step.balls.map((ball) => {
            const { trail } = ballFrame(ball, at, passing);
            return (
              trail && (
                <line
                  className={`tactical-player-pass ${ball.kind}`}
                  key={`${ball.kind}-${ball.fromId}`}
                  x1={trail.from.x}
                  x2={trail.to.x}
                  y1={trail.from.y}
                  y2={trail.to.y}
                />
              )
            );
          })}
          {diagram.tokens.map((token) => {
            const point = at(token.id);
            return (
              <g
                className={active.has(token.id) ? "tactical-player-token" : "tactical-player-token idle"}
                key={token.id}
                transform={`translate(${point.x} ${point.y})`}
              >
                <circle className={`tactical-diagram-token ${token.role}`} r="13" />
                <text className={`tactical-diagram-label ${token.role}`} textAnchor="middle" y="4">
                  {token.label}
                </text>
              </g>
            );
          })}
          {step.pressers.map((press) => {
            const point = at(press.id);
            return <circle className="tactical-player-ring press" cx={point.x} cy={point.y} key={press.id} r={18 + (1 - movement) * 6} />;
          })}
          {step.balls.map((ball) => {
            const frame = ballFrame(ball, at, passing);
            return (
              <g key={`${ball.kind}-${ball.fromId}`}>
                {frame.holder && <circle className="tactical-player-ring" cx={frame.holder.x} cy={frame.holder.y} r="18" />}
                <circle className="tactical-player-ball" cx={frame.ball.x + 9} cy={frame.ball.y - 9} r="4.5" />
              </g>
            );
          })}
        </svg>
      </div>

      <div aria-hidden="true" className="tactical-player-progress">
        {steps.map((_, index) => (
          <span key={index}>
            <i style={{ width: `${index < stepIndex ? 100 : index === stepIndex ? progress * 100 : 0}%` }} />
          </span>
        ))}
      </div>
      <p className="tactical-player-caption">{step.caption}</p>
      <div className="tactical-player-controls">
        <button aria-label={`Vitesse ${speed === 1 ? "normale" : "rapide"}, changer`} onClick={() => setSpeed(speed === 1 ? 2 : 1)} type="button">
          {speed}×
        </button>
        <button aria-label="Étape précédente" onClick={() => goTo(stepIndex - 1)} type="button">
          ‹
        </button>
        <button aria-label={playing ? "Mettre en pause" : "Lire l’animation"} className="primary" onClick={() => setPlayChoice(!playing)} type="button">
          {playing ? "❚❚" : "▶"}
        </button>
        <button aria-label="Étape suivante" onClick={() => goTo(stepIndex + 1)} type="button">
          ›
        </button>
      </div>
    </div>
  );
}
