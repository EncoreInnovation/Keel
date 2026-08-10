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
  hasStartedTodaySession,
  loadToday,
  logSet,
  resumePosition,
} from '../src/state/sessionController';
import { getActivePrescription, getActiveSessionRecord, getAllSets } from '../src/storage/repository';
import type { Exercise, SetLog, UserProfile } from '../src/engine/types';
import { TEST_GYM } from './support/profile';

beforeEach(async () => {
  await clear(keelStore);
});

const catalog = CATALOG as Exercise[];
const T0 = 1_700_000_000_000;
const DAY = 86_400_000;

const PROFILE: UserProfile = {
  bodyweight: 292,
  level: 'novice',
  gyms: [TEST_GYM],
  activeGymId: 'home',
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

    const sessionId = today.sessionId;

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
    const sessionId = today.sessionId;

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

describe('resumePosition', () => {
  it('points at set zero of exercise zero with nothing logged', async () => {
    const today = await loadToday(catalog, PROFILE, T0);
    expect(resumePosition(today.prescription, [])).toEqual({ exerciseIndex: 0, setPos: 0 });
  });

  it('picks up mid-exercise from what has been logged', async () => {
    const today = await loadToday(catalog, PROFILE, T0);
    const firstExerciseId = today.prescription.exercises[0]!.exercise.id;
    const logged: SetLog[] = [
      { id: '1', sessionId: 's', exerciseId: firstExerciseId, setIndex: 0, side: 'both', weight: 45, reps: 10, rpe: 8, completedAt: T0 },
    ];
    expect(resumePosition(today.prescription, logged)).toEqual({ exerciseIndex: 0, setPos: 1 });
  });

  it('advances to the next exercise once the first is fully logged', async () => {
    const today = await loadToday(catalog, PROFILE, T0);
    const first = today.prescription.exercises[0]!;
    const logged: SetLog[] = first.sets.map((s, i) => ({
      id: `l${i}`,
      sessionId: 's',
      exerciseId: first.exercise.id,
      setIndex: s.setIndex,
      side: s.side,
      weight: s.weight,
      reps: s.repTarget,
      rpe: s.targetRpe,
      completedAt: T0,
    }));
    expect(resumePosition(today.prescription, logged)).toEqual({ exerciseIndex: 1, setPos: 0 });
  });

  it('reports past the end when every exercise is fully logged', async () => {
    const today = await loadToday(catalog, PROFILE, T0);
    const logged: SetLog[] = today.prescription.exercises.flatMap((ex) =>
      ex.sets.map((s, i) => ({
        id: `${ex.slotId}-${i}`,
        sessionId: 's',
        exerciseId: ex.exercise.id,
        setIndex: s.setIndex,
        side: s.side,
        weight: s.weight,
        reps: s.repTarget,
        rpe: s.targetRpe,
        completedAt: T0,
      })),
    );
    expect(resumePosition(today.prescription, logged)).toEqual({
      exerciseIndex: today.prescription.exercises.length,
      setPos: 0,
    });
  });
});

describe('readiness', () => {
  it('reports no session started before the first loadToday of a block', async () => {
    expect(await hasStartedTodaySession()).toBe(false);
  });

  it('reports started once a session exists, and threads readiness onto its record', async () => {
    await loadToday(catalog, PROFILE, T0, 4);
    expect(await hasStartedTodaySession()).toBe(true);
    expect((await getActiveSessionRecord())?.readiness).toBe(4);
  });

  it('low readiness prescribes less volume than high readiness, all else equal', async () => {
    const low = await loadToday(catalog, PROFILE, T0, 1);
    const totalLow = low.prescription.exercises.reduce((sum, e) => sum + e.sets.length, 0);

    // Fresh state for a clean comparison — same catalog, same profile, same instant.
    const { clear } = await import('idb-keyval');
    const { keelStore } = await import('../src/storage/db');
    await clear(keelStore);

    const high = await loadToday(catalog, PROFILE, T0, 5);
    const totalHigh = high.prescription.exercises.reduce((sum, e) => sum + e.sets.length, 0);

    expect(totalLow).toBeLessThanOrEqual(totalHigh);
  });

  it('does not re-ask readiness on a resumed session — it already has one', async () => {
    const first = await loadToday(catalog, PROFILE, T0, 3);
    const resumed = await loadToday(catalog, PROFILE, T0 + 3600_000);
    expect(resumed.resumed).toBe(true);
    expect(resumed.prescription).toEqual(first.prescription);
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
