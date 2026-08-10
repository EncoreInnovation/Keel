/**
 * Integration tests for the session controller — the seam between the pure
 * engine and the storage layer. Each of those is well covered on its own;
 * what's untested until now is the wiring: does "today" actually resume
 * instead of regenerating, does a logged set survive being re-read as if the
 * app restarted, does completing a session let tomorrow's `loadToday` pick
 * the next day in the rotation.
 */

import { clear } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { keelStore } from '../src/storage/db';
import { CATALOG } from '../catalog/exercises';
import {
  completeSession,
  ensureActiveBlock,
  loadToday,
  logSet,
} from '../src/state/sessionController';
import { getActivePrescription, getAllSets } from '../src/storage/repository';
import type { Exercise, UserProfile } from '../src/engine/types';

beforeEach(async () => {
  await clear(keelStore);
});

const catalog = CATALOG as Exercise[];
const T0 = 1_700_000_000_000;
const DAY = 86_400_000;

const PROFILE: UserProfile = {
  bodyweight: 292,
  level: 'novice',
  availableEquipment: [
    'bodyweight',
    'dumbbell',
    'kettlebell',
    'band',
    'suspension',
    'pullupBar',
    'bench',
    'mat',
    'wall',
    'chair',
  ],
  dumbbellIncrement: 5,
  flaggedJoints: [],
  impactCeiling: 'low',
  daysPerWeek: 4,
  sessionMinutes: 40,
};

describe('ensureActiveBlock', () => {
  it('creates a block on first load and reuses it on the next', async () => {
    const first = await ensureActiveBlock(catalog, PROFILE, T0);
    const second = await ensureActiveBlock(catalog, PROFILE, T0 + DAY);
    expect(second.id).toBe(first.id);
  });
});

describe('loadToday', () => {
  it('generates a fresh session on first load', async () => {
    const today = await loadToday(catalog, PROFILE, T0);
    expect(today.resumed).toBe(false);
    expect(today.prescription.exercises.length).toBeGreaterThan(0);
    expect(today.prescription.dayId).toBe('a');
  });

  it('resumes the same prescription rather than regenerating it', async () => {
    const first = await loadToday(catalog, PROFILE, T0);
    const second = await loadToday(catalog, PROFILE, T0 + 3600_000);

    expect(second.resumed).toBe(true);
    expect(second.prescription).toEqual(first.prescription);
  });

  it('persists the prescription immediately, before any set is logged', async () => {
    const today = await loadToday(catalog, PROFILE, T0);
    expect(await getActivePrescription()).toEqual(today.prescription);
  });
});

describe('logSet', () => {
  it('writes the set before returning, and it survives a fresh read', async () => {
    const today = await loadToday(catalog, PROFILE, T0);
    const exercise = today.prescription.exercises[0]!;
    const slot = today.block.days.find((d) => d.id === today.prescription.dayId)!.slots.find(
      (s) => s.id === exercise.slotId,
    )!;
    const firstSet = exercise.sets[0]!;

    const sessionId = `sess-${today.block.id}-${today.prescription.weekNumber}-${today.prescription.dayId}-${T0}`;

    await logSet(sessionId, {
      prescription: today.prescription,
      slot,
      exerciseIndex: 0,
      setIndex: firstSet.setIndex,
      side: firstSet.side,
      weight: firstSet.weight,
      reps: firstSet.repTarget,
      rpe: slot.targetRpe,
      at: T0 + 60_000,
      profile: PROFILE,
    });

    const sets = await getAllSets();
    expect(sets).toHaveLength(1);
    expect(sets[0]!.exerciseId).toBe(exercise.exercise.id);
  });

  it('persists the adjusted prescription so a resume shows the new targets, not the stale ones', async () => {
    const today = await loadToday(catalog, PROFILE, T0);
    const exercise = today.prescription.exercises[0]!;
    const slot = today.block.days.find((d) => d.id === today.prescription.dayId)!.slots.find(
      (s) => s.id === exercise.slotId,
    )!;
    const firstSet = exercise.sets[0]!;
    const sessionId = `sess-${today.block.id}-${today.prescription.weekNumber}-${today.prescription.dayId}-${T0}`;

    // A clear overshoot: well past the top of the range at a low RPE.
    const { prescription: updated, adjustment } = await logSet(sessionId, {
      prescription: today.prescription,
      slot,
      exerciseIndex: 0,
      setIndex: firstSet.setIndex,
      side: firstSet.side,
      weight: firstSet.weight,
      reps: slot.repMax + 4,
      rpe: slot.targetRpe - 2,
      at: T0 + 60_000,
      profile: PROFILE,
    });

    if (firstSet.weight > 0) {
      expect(adjustment.action).toBe('increase');
    }

    // "As if the app were killed and reopened": read the persisted
    // prescription completely fresh, not the in-memory return value.
    const persisted = await getActivePrescription();
    expect(persisted).toEqual(updated);
  });
});

describe('completeSession → next loadToday', () => {
  it('advances to the next day in the rotation after a session is completed', async () => {
    const dayIds: string[] = [];

    for (let i = 0; i < 4; i += 1) {
      const at = T0 + i * DAY;
      const today = await loadToday(catalog, PROFILE, at);
      dayIds.push(today.prescription.dayId);
      await completeSession(at + 30 * 60_000);
    }

    expect(dayIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('has no active prescription immediately after completing', async () => {
    const today = await loadToday(catalog, PROFILE, T0);
    await completeSession(T0 + 60_000);
    expect(await getActivePrescription()).toBeUndefined();
    void today;
  });
});
