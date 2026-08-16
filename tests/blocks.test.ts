import { describe, expect, it } from 'vitest';
import { CATALOG, CATALOG_BY_ID } from '../catalog/exercises';
import { createBlock, HYPERTROPHY_BLOCK_DAYS, generateSession, swapExerciseInSlot } from '../src/engine/blocks';
import { epley1RM } from '../src/engine/overload';
import { TEST_GYM, testProfile } from './support/profile';
import type { Exercise, SetLog } from '../src/engine/types';
import type { SelectionContext } from '../src/engine/selector';

const T0 = 1_700_000_000_000;
const catalog = CATALOG as Exercise[];
const profile = testProfile();

function makeContext(): SelectionContext {
  return {
    recovery: Object.fromEntries(
      ['chest', 'upperBack', 'lats', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'lowerBack', 'glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'neck'].map((m) => [m, 1]),
    ) as SelectionContext['recovery'],
    profile,
    impactCeiling: 'low',
    recentExerciseIds: [],
    historyCounts: new Map(),
    painFlags: new Set(),
  };
}

function makeSet(over: Partial<SetLog>): SetLog {
  return {
    id: 's', sessionId: 'sess', exerciseId: 'x', setIndex: 0, side: 'both',
    weight: 45, reps: 8, rpe: 8, completedAt: T0,
    ...over,
  };
}

describe('generateSession — bestE1RM', () => {
  it('reports the best e1RM ever logged for a locked primary, not just the last session', () => {
    const ctx = makeContext();
    const block = createBlock('b', 'Test Block', HYPERTROPHY_BLOCK_DAYS, catalog, ctx, T0);
    const primaryId = block.lockedAssignments['push-primary']!;

    // Best session was two sessions ago, not the most recent one — proves
    // this reads across all history rather than just the last attempt.
    const history: SetLog[] = [
      makeSet({ id: 'a', exerciseId: primaryId, weight: 30, reps: 8, completedAt: T0 - 3 * 86_400_000 }),
      makeSet({ id: 'b', exerciseId: primaryId, weight: 50, reps: 10, completedAt: T0 - 2 * 86_400_000 }),
      makeSet({ id: 'c', exerciseId: primaryId, weight: 35, reps: 6, completedAt: T0 - 1 * 86_400_000 }),
    ];
    const expectedBest = Math.max(...history.map((s) => epley1RM(s.weight, s.reps)));

    const session = generateSession({
      block, weekNumber: 1, dayId: 'push', catalog, ctx, profile, history, volumeMultiplier: 1,
    });

    const primary = session.exercises.find((e) => e.slotId === 'push-primary')!;
    expect(primary.bestE1RM).toBeCloseTo(expectedBest, 5);
  });

  it('leaves bestE1RM undefined when the exercise has never been logged', () => {
    const ctx = makeContext();
    const block = createBlock('b', 'Test Block', HYPERTROPHY_BLOCK_DAYS, catalog, ctx, T0);

    const session = generateSession({
      block, weekNumber: 1, dayId: 'push', catalog, ctx, profile, history: [], volumeMultiplier: 1,
    });

    const primary = session.exercises.find((e) => e.slotId === 'push-primary')!;
    expect(primary.bestE1RM).toBeUndefined();
  });

  it('ignores skipped and unloaded sets when finding the best e1RM', () => {
    const ctx = makeContext();
    const block = createBlock('b', 'Test Block', HYPERTROPHY_BLOCK_DAYS, catalog, ctx, T0);
    const primaryId = block.lockedAssignments['push-primary']!;

    const history: SetLog[] = [
      makeSet({ id: 'a', exerciseId: primaryId, weight: 200, reps: 10, skipped: true, completedAt: T0 - 2 * 86_400_000 }),
      makeSet({ id: 'b', exerciseId: primaryId, weight: 0, reps: 20, completedAt: T0 - 2 * 86_400_000 }),
      makeSet({ id: 'c', exerciseId: primaryId, weight: 30, reps: 8, completedAt: T0 - 1 * 86_400_000 }),
    ];

    const session = generateSession({
      block, weekNumber: 1, dayId: 'push', catalog, ctx, profile, history, volumeMultiplier: 1,
    });

    const primary = session.exercises.find((e) => e.slotId === 'push-primary')!;
    expect(primary.bestE1RM).toBeCloseTo(epley1RM(30, 8), 5);
  });
});

describe('swapExerciseInSlot', () => {
  it('rebuilds the slot around the chosen exercise instead of the selected one', () => {
    const ctx = makeContext();
    const block = createBlock('b', 'Test Block', HYPERTROPHY_BLOCK_DAYS, catalog, ctx, T0);
    const chosen = CATALOG_BY_ID.get('dumbbell-lateral-raise')!;

    const result = swapExerciseInSlot(
      block, 'push', 'push-acc-1', chosen, TEST_GYM, profile, [], ctx.recovery, 1, 1,
    );

    expect(result.exercise.id).toBe('dumbbell-lateral-raise');
    expect(result.slotId).toBe('push-acc-1');
    expect(result.role).toBe('accessory');
  });

  it('sizes sets to the slot the exercise is swapped into, not the exercise\'s home slot', () => {
    const ctx = makeContext();
    const block = createBlock('b', 'Test Block', HYPERTROPHY_BLOCK_DAYS, catalog, ctx, T0);
    const chosen = CATALOG_BY_ID.get('dumbbell-lateral-raise')!;

    const result = swapExerciseInSlot(
      block, 'push', 'push-acc-1', chosen, TEST_GYM, profile, [], ctx.recovery, 1, 1,
    );

    const slotDef = HYPERTROPHY_BLOCK_DAYS.find((d) => d.id === 'push')!.slots.find((s) => s.id === 'push-acc-1')!;
    for (const set of result.sets) {
      expect(set.repTarget).toBe(slotDef.repMin);
      expect(set.targetRpe).toBe(slotDef.targetRpe);
    }
  });

  it('refuses to swap a locked primary slot', () => {
    const ctx = makeContext();
    const block = createBlock('b', 'Test Block', HYPERTROPHY_BLOCK_DAYS, catalog, ctx, T0);
    const chosen = CATALOG_BY_ID.get('dumbbell-lateral-raise')!;

    expect(() =>
      swapExerciseInSlot(block, 'push', 'push-primary', chosen, TEST_GYM, profile, [], ctx.recovery, 1, 1),
    ).toThrow(/locked primary/);
  });

  it('throws for an unknown slot id', () => {
    const ctx = makeContext();
    const block = createBlock('b', 'Test Block', HYPERTROPHY_BLOCK_DAYS, catalog, ctx, T0);
    const chosen = CATALOG_BY_ID.get('dumbbell-lateral-raise')!;

    expect(() =>
      swapExerciseInSlot(block, 'push', 'not-a-real-slot', chosen, TEST_GYM, profile, [], ctx.recovery, 1, 1),
    ).toThrow();
  });

  it('applies deload scaling on the deload week same as fresh generation would', () => {
    const ctx = makeContext();
    const block = createBlock('b', 'Test Block', HYPERTROPHY_BLOCK_DAYS, catalog, ctx, T0);
    const chosen = CATALOG_BY_ID.get('dumbbell-lateral-raise')!;

    const normal = swapExerciseInSlot(block, 'push', 'push-acc-1', chosen, TEST_GYM, profile, [], ctx.recovery, 1, 1);
    const deloadWeek = swapExerciseInSlot(block, 'push', 'push-acc-1', chosen, TEST_GYM, profile, [], ctx.recovery, block.deloadWeek, 1);

    expect(deloadWeek.sets.length).toBeLessThan(normal.sets.length);
  });
});
