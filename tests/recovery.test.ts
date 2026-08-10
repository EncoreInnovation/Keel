import { describe, expect, it } from 'vitest';
import {
  applyConditioning,
  applySet,
  decayTo,
  earnedImpactCeiling,
  halfLifeFor,
  initialFatigueState,
  primaryRecovery,
  recoveryAt,
  rpeFactor,
  volumeMultiplier,
} from '../src/engine/recovery';
import type { ConditioningLog, Exercise, SetLog } from '../src/engine/types';

const HOUR = 3_600_000;
const T0 = 1_700_000_000_000;

function makeExercise(over: Partial<Exercise> = {}): Exercise {
  return {
    id: 'test-squat',
    name: 'Test Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    patterns: ['squat'],
    equipment: ['bodyweight'],
    loadType: 'bodyweight',
    impact: 'none',
    level: 'novice',
    unilateral: false,
    goalFit: 0.5,
    correctiveFit: 0.5,
    jointLoad: ['knee'],
    instructions: [],
    images: [],
    ...over,
  };
}

function makeSet(over: Partial<SetLog> = {}): SetLog {
  return {
    id: 's1',
    sessionId: 'sess1',
    exerciseId: 'test-squat',
    setIndex: 0,
    side: 'both',
    weight: 45,
    reps: 10,
    rpe: 8,
    completedAt: T0,
    ...over,
  };
}

describe('rpeFactor', () => {
  it('floors easy work at 0.2 rather than discarding it', () => {
    expect(rpeFactor(5)).toBe(0.2);
    expect(rpeFactor(1)).toBe(0.2);
  });

  it('scales linearly to 1.0 at RPE 10', () => {
    expect(rpeFactor(10)).toBe(1);
    expect(rpeFactor(7.5)).toBeCloseTo(0.5, 5);
  });

  it('separates hard sets from easy ones — the whole point of effective reps', () => {
    expect(rpeFactor(9)).toBeGreaterThan(rpeFactor(6) * 2);
  });
});

describe('fatigue decay', () => {
  it('halves at exactly one half-life', () => {
    const state = initialFatigueState(T0);
    state.fatigue.quads = 0.8;

    const later = decayTo(state, T0 + halfLifeFor('quads') * HOUR);
    expect(later.fatigue.quads).toBeCloseTo(0.4, 5);
  });

  it('clears large muscles to near-recovered by 72h', () => {
    const state = initialFatigueState(T0);
    state.fatigue.quads = 1;

    const recovery = recoveryAt(state, T0 + 72 * HOUR);
    expect(recovery.quads).toBeGreaterThan(0.8);
  });

  it('clears small muscles faster than large ones', () => {
    const state = initialFatigueState(T0);
    state.fatigue.quads = 1;
    state.fatigue.biceps = 1;

    const recovery = recoveryAt(state, T0 + 48 * HOUR);
    expect(recovery.biceps).toBeGreaterThan(recovery.quads);
  });

  it('never runs backwards in time', () => {
    const state = initialFatigueState(T0);
    state.fatigue.quads = 0.5;
    expect(decayTo(state, T0 - 10 * HOUR).fatigue.quads).toBe(0.5);
  });
});

describe('applySet', () => {
  it('fatigues primary movers more than secondary ones', () => {
    const state = applySet(initialFatigueState(T0), makeSet(), makeExercise());
    expect(state.fatigue.quads).toBeGreaterThan(state.fatigue.hamstrings);
    expect(state.fatigue.hamstrings).toBeGreaterThan(0);
  });

  it('ignores skipped sets entirely', () => {
    const state = applySet(initialFatigueState(T0), makeSet({ skipped: true }), makeExercise());
    expect(state.fatigue.quads).toBe(0);
  });

  it('clamps at 1 no matter how much volume is thrown at it', () => {
    let state = initialFatigueState(T0);
    for (let i = 0; i < 60; i += 1) {
      state = applySet(state, makeSet({ reps: 20, rpe: 10 }), makeExercise());
    }
    expect(state.fatigue.quads).toBeLessThanOrEqual(1);
  });

  it('is order-independent for sets logged at the same instant', () => {
    const a = applySet(
      applySet(initialFatigueState(T0), makeSet({ id: 'a', rpe: 7 }), makeExercise()),
      makeSet({ id: 'b', rpe: 9 }),
      makeExercise(),
    );
    const b = applySet(
      applySet(initialFatigueState(T0), makeSet({ id: 'b', rpe: 9 }), makeExercise()),
      makeSet({ id: 'a', rpe: 7 }),
      makeExercise(),
    );
    expect(a.fatigue.quads).toBeCloseTo(b.fatigue.quads, 10);
  });
});

describe('conditioning', () => {
  const run: ConditioningLog = {
    id: 'c1',
    kind: 'run',
    startedAt: T0,
    durationSec: 1800,
    effort: 6,
    impact: 'moderate',
    source: 'strava',
  };

  it('a 30 minute run measurably fatigues the legs', () => {
    const state = applyConditioning(initialFatigueState(T0), run);
    expect(state.fatigue.calves).toBeGreaterThan(0.2);
    expect(state.fatigue.quads).toBeGreaterThan(0.15);
  });

  it('leaves the upper body alone', () => {
    const state = applyConditioning(initialFatigueState(T0), run);
    expect(state.fatigue.chest).toBe(0);
    expect(state.fatigue.biceps).toBe(0);
  });

  it('accrues joint load only from impact work', () => {
    const impactful = applyConditioning(initialFatigueState(T0), run);
    const zeroImpact = applyConditioning(initialFatigueState(T0), { ...run, impact: 'none' });

    expect(impactful.jointLoad).toBeGreaterThan(0);
    expect(zeroImpact.jointLoad).toBe(0);
  });

  it('scales with effort', () => {
    const easy = applyConditioning(initialFatigueState(T0), { ...run, effort: 3 });
    const hard = applyConditioning(initialFatigueState(T0), { ...run, effort: 9 });
    expect(hard.fatigue.quads).toBeGreaterThan(easy.fatigue.quads);
  });
});

describe('primaryRecovery', () => {
  it('averages across the primary movers only', () => {
    const recovery = recoveryAt(initialFatigueState(T0), T0);
    recovery.quads = 0.4;
    recovery.glutes = 0.8;
    recovery.hamstrings = 0;

    expect(primaryRecovery(recovery, makeExercise())).toBeCloseTo(0.6, 5);
  });
});

describe('volumeMultiplier', () => {
  it('stays inside a tight band so a session is never redesigned', () => {
    for (const load of [0, 0.5, 1, 1.5]) {
      for (const readiness of [1, 3, 5, undefined]) {
        const m = volumeMultiplier(load, readiness);
        expect(m).toBeGreaterThanOrEqual(0.8);
        expect(m).toBeLessThanOrEqual(1.2);
      }
    }
  });

  it('cuts volume when load is high and readiness is low', () => {
    expect(volumeMultiplier(1.4, 1)).toBeLessThan(volumeMultiplier(0.2, 5));
  });
});

describe('earnedImpactCeiling', () => {
  it('gives a beginner nothing, regardless of accumulated load', () => {
    expect(earnedImpactCeiling(500, 1)).toBe('none');
  });

  it('unlocks tiers only as weeks and tolerated load accumulate', () => {
    expect(earnedImpactCeiling(0, 4)).toBe('low');
    expect(earnedImpactCeiling(80, 8)).toBe('moderate');
    expect(earnedImpactCeiling(200, 12)).toBe('high');
  });

  it('holds back a high-volume beginner — time under load is not optional', () => {
    expect(earnedImpactCeiling(300, 5)).toBe('low');
  });
});
