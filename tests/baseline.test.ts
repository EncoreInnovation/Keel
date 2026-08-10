/**
 * The baseline test's whole job is to replace guessing with measuring. These
 * tests defend the two ways it could still be wrong: producing a weight that
 * doesn't exist, or producing one that's dangerous.
 */

import { describe, expect, it } from 'vitest';
import {
  e1rmFromTestSet,
  ladderChain,
  percentOfMaxForReps,
  repsInReserve,
  startingRungFrom,
  workingWeightFromE1RM,
} from '../src/engine/baseline';
import { buildLadderIndex } from '../src/engine/ladders';
import { CATALOG } from '../catalog/exercises';
import { SPARSE_LOADS, DENSE_LOADS } from './support/profile';
import type { Exercise } from '../src/engine/types';

const catalog = CATALOG as Exercise[];
const byId = new Map(catalog.map((e) => [e.id, e]));
const index = buildLadderIndex(catalog);

describe('repsInReserve', () => {
  it('maps RPE to reps left, with 10 meaning nothing left', () => {
    expect(repsInReserve(10)).toBe(0);
    expect(repsInReserve(8)).toBe(2);
    expect(repsInReserve(6)).toBe(4);
  });

  it('never goes negative on a nonsense RPE', () => {
    expect(repsInReserve(12)).toBe(0);
  });
});

describe('e1rmFromTestSet', () => {
  it('counts reps left in reserve, so an easy set is not mistaken for a limit set', () => {
    const hard = e1rmFromTestSet({ exerciseId: 'x', weight: 100, reps: 10, rpe: 10 });
    const easy = e1rmFromTestSet({ exerciseId: 'x', weight: 100, reps: 10, rpe: 7 });
    // Same weight and reps, but the easy set implies a bigger max.
    expect(easy).toBeGreaterThan(hard);
  });

  it('is monotonic in weight and in reps', () => {
    const base = { exerciseId: 'x', reps: 8, rpe: 8 };
    expect(e1rmFromTestSet({ ...base, weight: 120 })).toBeGreaterThan(
      e1rmFromTestSet({ ...base, weight: 100 }),
    );
    expect(e1rmFromTestSet({ exerciseId: 'x', weight: 100, reps: 10, rpe: 8 })).toBeGreaterThan(
      e1rmFromTestSet({ exerciseId: 'x', weight: 100, reps: 6, rpe: 8 }),
    );
  });

  it('returns 0 rather than a fake number for an empty test', () => {
    expect(e1rmFromTestSet({ exerciseId: 'x', weight: 0, reps: 0, rpe: 8 })).toBe(0);
  });

  it('produces a believable max for a realistic goblet squat test', () => {
    // 30 lb for 12 @ RPE 8 — a plausible first test on the home rack.
    const e1rm = e1rmFromTestSet({ exerciseId: 'goblet-squat', weight: 30, reps: 12, rpe: 8 });
    expect(e1rm).toBeGreaterThan(40);
    expect(e1rm).toBeLessThan(70);
  });
});

describe('percentOfMaxForReps', () => {
  it('is 100% at a single rep and falls as reps rise', () => {
    expect(percentOfMaxForReps(1)).toBe(1);
    expect(percentOfMaxForReps(5)).toBeLessThan(1);
    expect(percentOfMaxForReps(12)).toBeLessThan(percentOfMaxForReps(5));
  });
});

describe('workingWeightFromE1RM', () => {
  it('only ever returns a weight that physically exists', () => {
    for (const e1rm of [25, 40, 55, 80, 130, 300]) {
      const w = workingWeightFromE1RM(e1rm, 12, SPARSE_LOADS);
      expect(SPARSE_LOADS).toContain(w);
    }
  });

  it('aims light rather than heavy, so the first session is not a max attempt', () => {
    const e1rm = 100;
    const w = workingWeightFromE1RM(e1rm, 12, DENSE_LOADS);
    expect(w).toBeLessThan(e1rm * 0.8);
  });

  it('gives a heavier working weight for a stronger lifter', () => {
    const weak = workingWeightFromE1RM(50, 10, DENSE_LOADS);
    const strong = workingWeightFromE1RM(150, 10, DENSE_LOADS);
    expect(strong).toBeGreaterThan(weak);
  });

  it('returns 0 when there is no test and nothing to go on', () => {
    expect(workingWeightFromE1RM(0, 10, DENSE_LOADS)).toBe(0);
  });
});

describe('ladderChain', () => {
  it('returns the full chain regardless of which rung it is handed', () => {
    const fromBottom = ladderChain(byId.get('wall-pushup')!, index, byId).map((e) => e.id);
    const fromMiddle = ladderChain(byId.get('knee-pushup')!, index, byId).map((e) => e.id);
    expect(fromBottom).toEqual(fromMiddle);
    expect(fromBottom[0]).toBe('wall-pushup');
    expect(fromBottom).toContain('pushup');
  });

  it('orders easiest to hardest', () => {
    const chain = ladderChain(byId.get('wall-pushup')!, index, byId).map((e) => e.id);
    expect(chain.indexOf('wall-pushup')).toBeLessThan(chain.indexOf('incline-pushup'));
    expect(chain.indexOf('incline-pushup')).toBeLessThan(chain.indexOf('pushup'));
  });

  it('handles an exercise with no ladder as a chain of one', () => {
    const solo = ladderChain(byId.get('farmer-carry')!, index, byId);
    expect(solo.map((e) => e.id)).toEqual(['farmer-carry']);
  });
});

describe('startingRungFrom — the fix for "everyone starts at wall push-ups"', () => {
  const chain = ladderChain(byId.get('wall-pushup')!, index, byId);
  const pushup = byId.get('pushup')!;

  it('keeps a man who can do 12 push-ups ON push-ups', () => {
    // The exact case the browser caught: 12 reps must not mean wall push-ups.
    expect(startingRungFrom(pushup, 12, chain)!.id).toBe('pushup');
  });

  it('drops someone who can only manage a couple of push-ups down the chain', () => {
    const rung = startingRungFrom(pushup, 2, chain)!;
    expect(chain.indexOf(rung)).toBeLessThan(chain.indexOf(pushup));
  });

  it('drops only one rung for a borderline effort', () => {
    const rung = startingRungFrom(pushup, 5, chain)!;
    expect(chain.indexOf(rung)).toBe(chain.indexOf(pushup) - 1);
  });

  it('moves up when the tested variation is clearly too easy', () => {
    const midChain = byId.get('incline-pushup')!;
    const rung = startingRungFrom(midChain, 25, chain)!;
    expect(chain.indexOf(rung)).toBeGreaterThan(chain.indexOf(midChain));
  });

  it('is monotonic — more reps never places you lower', () => {
    const indices = [1, 4, 8, 12, 20, 40].map((r) =>
      chain.indexOf(startingRungFrom(pushup, r, chain)!),
    );
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]!).toBeGreaterThanOrEqual(indices[i - 1]!);
    }
  });

  it('never runs off either end of the chain', () => {
    expect(chain).toContain(startingRungFrom(pushup, 500, chain)!);
    expect(chain).toContain(startingRungFrom(chain[0]!, 0, chain)!);
  });

  it('returns nothing for an empty chain rather than throwing', () => {
    expect(startingRungFrom(pushup, 10, [])).toBeUndefined();
  });
});
