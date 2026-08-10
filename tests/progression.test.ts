import { describe, expect, it } from 'vitest';
import {
  attemptCleared,
  attemptMissed,
  attemptsFor,
  buildLadderIndex,
  evaluateLadder,
  nextRung,
  rungDepth,
} from '../src/engine/ladders';
import {
  adjustRemainingSets,
  applyDeload,
  epley1RM,
  nextPrescription,
  updateE1RM,
} from '../src/engine/overload';
import { asymmetryFor, overallGap, sideOrder } from '../src/engine/asymmetry';
import { DENSE_LOADS, SPARSE_LOADS, testProfile } from './support/profile';
import type { Exercise, PrescribedSet, SetLog, Slot, UserProfile } from '../src/engine/types';

const T0 = 1_700_000_000_000;

const slot: Slot = {
  id: 'test',
  role: 'secondary',
  pattern: 'squat',
  sets: 3,
  repMin: 8,
  repMax: 12,
  targetRpe: 8,
  restSec: 120,
  locked: false,
};

const profile: UserProfile = testProfile();

function set(over: Partial<SetLog> = {}): SetLog {
  return {
    id: Math.random().toString(36).slice(2),
    sessionId: 'sess',
    exerciseId: 'ex',
    setIndex: 0,
    side: 'both',
    weight: 50,
    reps: 10,
    rpe: 8,
    completedAt: T0,
    ...over,
  };
}

/** Three working sets forming one session's attempt. */
function attempt(sessionId: string, at: number, reps: number, rpe: number): SetLog[] {
  return [0, 1, 2].map((i) =>
    set({ sessionId, setIndex: i, reps, rpe, completedAt: at + i * 60_000 }),
  );
}

describe('epley1RM', () => {
  it('returns the weight itself at one rep', () => {
    expect(epley1RM(200, 1)).toBeCloseTo(206.67, 1);
  });

  it('is zero for unloaded work', () => {
    expect(epley1RM(0, 12)).toBe(0);
  });

  it('stops extrapolating past 15 reps rather than inventing numbers', () => {
    expect(epley1RM(50, 30)).toBe(epley1RM(50, 15));
  });
});

describe('updateE1RM', () => {
  it('adopts the first observation outright', () => {
    expect(updateE1RM(undefined, 200)).toBe(200);
  });

  it('damps a single outlier instead of chasing it', () => {
    const smoothed = updateE1RM(200, 300);
    expect(smoothed).toBeGreaterThan(200);
    expect(smoothed).toBeLessThan(250);
  });
});

describe('nextPrescription on a sparse rack — the fixed-dumbbell problem', () => {
  // The home rack is [10, 20, 30]. Every jump is enormous, so "cleared the
  // range" must NOT mean "add weight" the way it would in a commercial gym.
  const sparseAttempt = (reps: number, rpe: number, weight: number) =>
    attempt('s1', T0, reps, rpe).map((s) => ({ ...s, weight }));

  it('refuses a 100% load jump and adds reps instead', () => {
    const result = nextPrescription({
      slot,
      lastAttempt: sparseAttempt(12, 7.5, 10),
      profile,
      loadable: true,
      achievable: SPARSE_LOADS,
    });
    expect(result.weight).toBe(10);
    expect(result.repTarget).toBeGreaterThan(slot.repMax);
    expect(result.rationale).toMatch(/jump|reps/i);
  });

  it('does take the jump when the next weight is a sane step', () => {
    const result = nextPrescription({
      slot,
      lastAttempt: attempt('s1', T0, 12, 7.5),
      profile,
      loadable: true,
      achievable: DENSE_LOADS,
    });
    expect(result.weight).toBeGreaterThan(50);
    expect(result.repTarget).toBe(slot.repMin);
  });

  it('adds reps at the top of the rack rather than inventing a heavier weight', () => {
    const result = nextPrescription({
      slot,
      lastAttempt: sparseAttempt(12, 7.5, 30),
      profile,
      loadable: true,
      achievable: SPARSE_LOADS,
    });
    expect(result.weight).toBe(30);
    expect(SPARSE_LOADS).toContain(result.weight);
    expect(result.rationale).toMatch(/heaviest/i);
  });

  it('caps the rep climb and calls for a harder variation instead of endless reps', () => {
    const maxed = slot.repMax + 6;
    const result = nextPrescription({
      slot,
      lastAttempt: sparseAttempt(maxed, 7.5, 30),
      profile,
      loadable: true,
      achievable: SPARSE_LOADS,
    });
    expect(result.repTarget).toBeLessThanOrEqual(maxed);
    expect(result.rationale).toMatch(/harder/i);
  });

  it('still backs off to a real weight after a grinder', () => {
    const result = nextPrescription({
      slot,
      lastAttempt: sparseAttempt(6, 9.5, 20),
      profile,
      loadable: true,
      achievable: SPARSE_LOADS,
    });
    expect(result.weight).toBe(10);
    expect(SPARSE_LOADS).toContain(result.weight);
  });
});

describe('nextPrescription — double progression', () => {
  it('adds load once the top of the range is cleared at target RPE', () => {
    const result = nextPrescription({
      slot,
      lastAttempt: attempt('s1', T0, 12, 7.5),
      profile,
      loadable: true,
      achievable: DENSE_LOADS,
    });
    expect(result.weight).toBeGreaterThan(50);
    expect(result.repTarget).toBe(slot.repMin);
  });

  it('holds load and adds a rep mid-range', () => {
    const result = nextPrescription({
      slot,
      lastAttempt: attempt('s1', T0, 10, 8),
      profile,
      loadable: true,
      achievable: DENSE_LOADS,
    });
    expect(result.weight).toBe(50);
    expect(result.repTarget).toBe(11);
  });

  it('backs off when the range was missed', () => {
    const result = nextPrescription({
      slot,
      lastAttempt: attempt('s1', T0, 6, 9),
      profile,
      loadable: true,
      achievable: DENSE_LOADS,
    });
    expect(result.weight).toBeLessThan(50);
  });

  it('backs off when RPE ran well over target even if reps were hit', () => {
    const result = nextPrescription({
      slot,
      lastAttempt: attempt('s1', T0, 10, 9.5),
      profile,
      loadable: true,
      achievable: DENSE_LOADS,
    });
    expect(result.weight).toBeLessThan(50);
  });

  it('never increases load past the top of the rep range at high RPE', () => {
    const result = nextPrescription({
      slot,
      lastAttempt: attempt('s1', T0, 12, 9.5),
      profile,
      loadable: true,
      achievable: DENSE_LOADS,
    });
    expect(result.weight).toBeLessThanOrEqual(50);
  });

  it('progresses unloaded work by reps, never by phantom weight', () => {
    const result = nextPrescription({
      slot,
      lastAttempt: attempt('s1', T0, 10, 8).map((s) => ({ ...s, weight: 0 })),
      profile,
      loadable: false,
      achievable: [],
    });
    expect(result.weight).toBe(0);
    expect(result.repTarget).toBe(11);
  });
});

describe('adjustRemainingSets — in-session autoregulation', () => {
  const remaining: PrescribedSet[] = [
    { setIndex: 1, weight: 50, repTarget: 10, targetRpe: 8, side: 'both' },
    { setIndex: 2, weight: 50, repTarget: 10, targetRpe: 8, side: 'both' },
  ];

  it('nudges up after a clear overshoot at low RPE', () => {
    const out = adjustRemainingSets(set({ reps: 14, rpe: 7 }), remaining, slot, DENSE_LOADS, 0);
    expect(out.action).toBe('increase');
    expect(out.remaining[0]!.weight).toBe(55);
  });

  it('holds when the set landed on target', () => {
    expect(adjustRemainingSets(set({ reps: 10, rpe: 8 }), remaining, slot, DENSE_LOADS, 0).action).toBe(
      'hold',
    );
  });

  it('backs off after a grinder', () => {
    const out = adjustRemainingSets(set({ reps: 10, rpe: 9.5 }), remaining, slot, DENSE_LOADS, 0);
    expect(out.action).toBe('decrease');
    expect(out.remaining[0]!.weight).toBeLessThan(50);
  });

  it('backs off when reps fall well short', () => {
    expect(adjustRemainingSets(set({ reps: 5, rpe: 8 }), remaining, slot, DENSE_LOADS, 0).action).toBe(
      'decrease',
    );
  });

  it('offers a regression after two consecutive misses instead of grinding on', () => {
    const out = adjustRemainingSets(set({ reps: 4, rpe: 10 }), remaining, slot, DENSE_LOADS, 2);
    expect(out.action).toBe('offerRegression');
  });

  it('never adjusts past the last set', () => {
    expect(adjustRemainingSets(set({ reps: 14, rpe: 6 }), [], slot, DENSE_LOADS, 0).action).toBe('hold');
  });

  it('adjusts by a bounded amount — it nudges, it does not rewrite', () => {
    const out = adjustRemainingSets(set({ reps: 20, rpe: 6 }), remaining, slot, DENSE_LOADS, 0);
    expect(out.remaining[0]!.weight).toBeLessThanOrEqual(55);
  });
});

describe('applyDeload', () => {
  const sets: PrescribedSet[] = [0, 1, 2, 3, 4].map((i) => ({
    setIndex: i,
    weight: 100,
    repTarget: 10,
    targetRpe: 8,
    side: 'both' as const,
  }));

  it('cuts volume and intensity together', () => {
    const out = applyDeload(sets, DENSE_LOADS);
    expect(out.length).toBeLessThan(sets.length);
    expect(out[0]!.weight).toBeLessThan(100);
    expect(out[0]!.targetRpe).toBeLessThanOrEqual(7);
  });

  it('always leaves at least one set — a deload is not a rest day', () => {
    expect(applyDeload([sets[0]!], DENSE_LOADS).length).toBe(1);
  });
});

describe('ladders', () => {
  const catalog: Exercise[] = [
    { id: 'a', progressionOf: undefined },
    { id: 'b', progressionOf: 'a' },
    { id: 'c', progressionOf: 'b' },
  ].map((partial, i) => ({
    name: `Rung ${i}`,
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    patterns: ['horizontalPush'],
    equipment: ['bodyweight'],
    loadType: 'bodyweight',
    impact: 'none',
    level: 'novice',
    unilateral: false,
    goalFit: 0.5,
    correctiveFit: 0.5,
    jointLoad: [],
    instructions: [],
    images: [],
    ...partial,
  })) as Exercise[];

  const index = buildLadderIndex(catalog);
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const equipment = new Set(['bodyweight']);

  it('derives upward edges by inverting the authored downward ones', () => {
    expect(index.up.get('a')).toEqual(['b']);
    expect(index.down.get('b')).toBe('a');
  });

  it('measures depth from the bottom of the ladder', () => {
    expect(rungDepth('a', index)).toBe(0);
    expect(rungDepth('c', index)).toBe(2);
  });

  it('requires two consecutive clears to advance', () => {
    const one = attemptsFor(attempt('s1', T0, 12, 7.5), 'ex');
    expect(evaluateLadder(one, slot)).toBe('hold');

    const two = attemptsFor(
      [...attempt('s1', T0, 12, 7.5), ...attempt('s2', T0 + 86_400_000, 12, 7.5)],
      'ex',
    );
    expect(evaluateLadder(two, slot)).toBe('advance');
  });

  it('requires two consecutive misses to regress', () => {
    const two = attemptsFor(
      [...attempt('s1', T0, 4, 10), ...attempt('s2', T0 + 86_400_000, 5, 10)],
      'ex',
    );
    expect(evaluateLadder(two, slot)).toBe('regress');
  });

  it('holds when results are mixed', () => {
    const mixed = attemptsFor(
      [...attempt('s1', T0, 12, 7), ...attempt('s2', T0 + 86_400_000, 4, 10)],
      'ex',
    );
    expect(evaluateLadder(mixed, slot)).toBe('hold');
  });

  it('does not advance off a high-RPE grind even when reps were hit', () => {
    const two = attemptsFor(
      [...attempt('s1', T0, 12, 9.5), ...attempt('s2', T0 + 86_400_000, 12, 9.5)],
      'ex',
    );
    expect(evaluateLadder(two, slot)).toBe('hold');
  });

  it('judges unilateral attempts on the weaker side', () => {
    const sets = [
      set({ sessionId: 's1', setIndex: 0, side: 'left', reps: 8, rpe: 8 }),
      set({ sessionId: 's1', setIndex: 0, side: 'right', reps: 12, rpe: 7 }),
    ];
    expect(attemptCleared(attemptsFor(sets, 'ex')[0]!, slot)).toBe(false);
  });

  it('moves one rung at a time in each direction', () => {
    expect(nextRung(byId.get('b')!, 'advance', index, byId, equipment).id).toBe('c');
    expect(nextRung(byId.get('b')!, 'regress', index, byId, equipment).id).toBe('a');
    expect(nextRung(byId.get('b')!, 'hold', index, byId, equipment).id).toBe('b');
  });

  it('stays put at the ends of the ladder', () => {
    expect(nextRung(byId.get('c')!, 'advance', index, byId, equipment).id).toBe('c');
    expect(nextRung(byId.get('a')!, 'regress', index, byId, equipment).id).toBe('a');
  });

  it('will not advance to a rung needing equipment the user lacks', () => {
    const gated = [...catalog];
    gated[2] = { ...gated[2]!, equipment: ['suspension'] };
    const gatedIndex = buildLadderIndex(gated);
    const gatedById = new Map(gated.map((e) => [e.id, e]));
    expect(nextRung(gatedById.get('b')!, 'advance', gatedIndex, gatedById, equipment).id).toBe('b');
  });

  it('leaves loadable exercises alone — they progress by weight', () => {
    const loadable = { ...byId.get('b')!, loadType: 'external' as const };
    expect(nextRung(loadable, 'advance', index, byId, equipment).id).toBe('b');
  });

  it('ignores skipped sets when grouping attempts', () => {
    const sets = [...attempt('s1', T0, 12, 7.5), set({ sessionId: 's1', skipped: true, reps: 0 })];
    expect(attemptsFor(sets, 'ex')[0]!.sets.length).toBe(3);
  });

  it('flags an attempt that fell under the bottom of the range', () => {
    expect(attemptMissed(attemptsFor(attempt('s1', T0, 6, 9), 'ex')[0]!, slot)).toBe(true);
  });
});

describe('asymmetry', () => {
  it('reports the right side as stronger when it lifts more', () => {
    const sets = [
      set({ side: 'left', weight: 40, reps: 10 }),
      set({ side: 'right', weight: 50, reps: 10 }),
    ];
    const reading = asymmetryFor(sets, 'ex')!;
    expect(reading.gap).toBeGreaterThan(0);
    expect(reading.significant).toBe(true);
  });

  it('returns nothing without data on both sides', () => {
    expect(asymmetryFor([set({ side: 'left' })], 'ex')).toBeUndefined();
  });

  it('ignores bilateral sets, which say nothing about sides', () => {
    expect(asymmetryFor([set({ side: 'both' }), set({ side: 'both' })], 'ex')).toBeUndefined();
  });

  it('treats a small gap as noise', () => {
    const sets = [
      set({ side: 'left', weight: 50, reps: 10 }),
      set({ side: 'right', weight: 50, reps: 10 }),
    ];
    expect(asymmetryFor(sets, 'ex')!.significant).toBe(false);
  });

  it('leads with the weaker side so the gap cannot widen', () => {
    const rightStronger = { gap: 0.3, significant: true } as never;
    const leftStronger = { gap: -0.3, significant: true } as never;
    expect(sideOrder(rightStronger)[0]).toBe('left');
    expect(sideOrder(leftStronger)[0]).toBe('right');
  });

  it('falls back to a stable order when there is no meaningful gap', () => {
    expect(sideOrder(undefined)).toEqual(['left', 'right']);
  });

  it('averages signed gaps across exercises', () => {
    expect(overallGap([{ gap: 0.2 }, { gap: 0.4 }] as never)).toBeCloseTo(0.3, 5);
    expect(overallGap([])).toBe(0);
  });
});
