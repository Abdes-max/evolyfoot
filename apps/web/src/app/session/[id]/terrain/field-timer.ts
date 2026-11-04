import { findProgramSituation, type TrainingSession } from "@evolyfoot/domain";

// Mode terrain : chaque bloc de la séance se joue en séquences chronométrées. Une situation de la
// saison guidée garde ses séquences (« 4 × 2 min ») ; un autre exercice se joue d'une traite.
export interface FieldStep {
  readonly blockId: string;
  readonly sequenceCount: number;
  readonly sequenceSeconds: number;
}

export function fieldSteps(session: Pick<TrainingSession, "blocks">): FieldStep[] {
  return session.blocks.map((block) => {
    const situation = findProgramSituation(block.activity.id);
    return situation
      ? { blockId: block.id, sequenceCount: situation.sequences.count, sequenceSeconds: situation.sequences.minutes * 60 }
      : { blockId: block.id, sequenceCount: 1, sequenceSeconds: block.durationMinutes * 60 };
  });
}

export interface FieldState {
  readonly step: number;
  readonly sequence: number;
  readonly remaining: number;
  readonly running: boolean;
  // Points du défi pour les deux équipes, remis à zéro à chaque situation.
  readonly scores: readonly [number, number];
}

export function startField(steps: readonly FieldStep[]): FieldState {
  return { step: 0, sequence: 1, remaining: steps[0]?.sequenceSeconds ?? 0, running: false, scores: [0, 0] };
}

// Une seconde passe ; en fin de séquence le minuteur s'arrête et attend le coach.
export function tick(state: FieldState): FieldState {
  if (!state.running) return state;
  const remaining = Math.max(0, state.remaining - 1);
  return { ...state, remaining, running: remaining > 0 };
}

export function toggle(state: FieldState): FieldState {
  return state.remaining > 0 ? { ...state, running: !state.running } : state;
}

export function goTo(steps: readonly FieldStep[], step: number): FieldState {
  const index = Math.min(Math.max(step, 0), steps.length - 1);
  return { step: index, sequence: 1, remaining: steps[index]?.sequenceSeconds ?? 0, running: false, scores: [0, 0] };
}

// Séquence suivante de la même situation, ou situation suivante après la dernière séquence.
export function next(steps: readonly FieldStep[], state: FieldState): FieldState {
  const current = steps[state.step];
  if (!current) return state;
  if (state.sequence < current.sequenceCount) {
    return { ...state, sequence: state.sequence + 1, remaining: current.sequenceSeconds, running: true };
  }
  return state.step < steps.length - 1 ? goTo(steps, state.step + 1) : { ...state, running: false };
}

export function score(state: FieldState, team: 0 | 1, delta: 1 | -1): FieldState {
  const scores: [number, number] = [state.scores[0], state.scores[1]];
  scores[team] = Math.max(0, scores[team] + delta);
  return { ...state, scores };
}

export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
