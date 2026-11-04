import { findTrainingActivity } from "./training-session";
import { describe, expect, it } from "vitest";
import { clock, fieldSteps, goTo, next, score, startField, tick, toggle } from "./field-timer";

const session = {
  blocks: [
    { id: "b1", activity: findTrainingActivity("cfi-espaces-jonglage")!, durationMinutes: 10 },
    { id: "b2", activity: findTrainingActivity("welcome-conserver")!, durationMinutes: 15 },
  ],
};

describe("mode terrain : minuteur", () => {
  it("reprend les séquences d’une situation de la saison, et la durée du bloc sinon", () => {
    expect(fieldSteps(session)).toEqual([
      { blockId: "b1", sequenceCount: 4, sequenceSeconds: 120 },
      { blockId: "b2", sequenceCount: 1, sequenceSeconds: 900 },
    ]);
  });

  it("décompte seulement quand il tourne et s’arrête en fin de séquence", () => {
    const steps = fieldSteps(session);
    let state = startField(steps);
    expect(tick(state).remaining).toBe(120);
    state = toggle(state);
    state = tick(state);
    expect(state.remaining).toBe(119);
    state = { ...state, remaining: 1 };
    state = tick(state);
    expect(state).toMatchObject({ remaining: 0, running: false });
    expect(toggle(state).running).toBe(false);
  });

  it("enchaîne les séquences puis la situation suivante, scores remis à zéro", () => {
    const steps = fieldSteps(session);
    let state = score(startField(steps), 0, 1);
    state = next(steps, state);
    expect(state).toMatchObject({ step: 0, sequence: 2, remaining: 120, running: true, scores: [1, 0] });
    state = next(steps, next(steps, next(steps, state)));
    expect(state).toMatchObject({ step: 1, sequence: 1, remaining: 900, running: false, scores: [0, 0] });
    expect(next(steps, state)).toMatchObject({ step: 1, running: false });
    expect(goTo(steps, -3).step).toBe(0);
  });

  it("ne descend pas sous zéro point et affiche le temps en minutes", () => {
    expect(score(startField(fieldSteps(session)), 1, -1).scores).toEqual([0, 0]);
    expect(clock(125)).toBe("2:05");
  });
});
