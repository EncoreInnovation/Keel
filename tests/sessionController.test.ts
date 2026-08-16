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
  swapExercise,
} from '../src/state/sessionController';
import {
  getActivePrescription,
  getActiveSessionRecord,
  getAllSets,
  getCompletedSessions,
} from '../src/storage/repository';
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
    expect(today.prescription.dayId).toBe('push');
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
    expect(await hasStartedTodaySession(T0)).toBe(false);
  });

  it('reports started once a session exists, and threads readiness onto its record', async () => {
    await loadToday(catalog, PROFILE, T0, 4);
    expect(await hasStartedTodaySession(T0)).toBe(true);
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

  it('still reports started for a session resumed later the same day', async () => {
    await loadToday(catalog, PROFILE, T0, 3);
    // T0 isn't UTC-midnight-aligned, so this stays deliberately small — large
    // enough to prove "later" resumes correctly, small enough to guarantee it
    // can't cross into the next UTC calendar day regardless of T0's time-of-day.
    expect(await hasStartedTodaySession(T0 + 3600_000)).toBe(true);
  });
});

describe('stale session self-heal', () => {
  it('auto-closes a session abandoned on a previous calendar day rather than blocking forever', async () => {
    await loadToday(catalog, PROFILE, T0, 3);
    expect(await hasStartedTodaySession(T0)).toBe(true);

    // Reopen the app the next day without ever finishing or pausing —
    // exactly the "walked away" case the bug report described.
    const nextDayAt = T0 + DAY;
    expect(await hasStartedTodaySession(nextDayAt)).toBe(false);

    // The stale session is gone from "active" and filed as completed —
    // not silently discarded.
    expect(await getActiveSessionRecord()).toBeUndefined();
    const completed = await getCompletedSessions();
    expect(completed).toHaveLength(1);
    expect(completed[0]!.startedAt).toBe(T0);
  });

  it('a healed day generates a fresh session and asks readiness again', async () => {
    await loadToday(catalog, PROFILE, T0, 3);
    const nextDayAt = T0 + DAY;
    await hasStartedTodaySession(nextDayAt); // triggers the heal as a side effect, same as App.tsx's flow

    expect(await hasStartedTodaySession(nextDayAt)).toBe(false);
    const fresh = await loadToday(catalog, PROFILE, nextDayAt, 4);
    expect(fresh.resumed).toBe(false);
  });

  it('preserves any sets already logged before the stale session is closed', async () => {
    const state = await loadToday(catalog, PROFILE, T0, 3);
    const exercise = state.prescription.exercises[0]!;
    const slot = state.block.days
      .find((d) => d.id === state.prescription.dayId)!
      .slots.find((s) => s.id === exercise.slotId)!;
    const firstSet = exercise.sets[0]!;

    await logSet(state.sessionId, {
      prescription: state.prescription,
      slot,
      exerciseIndex: 0,
      setIndex: firstSet.setIndex,
      side: firstSet.side,
      weight: firstSet.weight,
      reps: firstSet.repTarget,
      rpe: 8,
      at: T0 + 60_000,
      profile: PROFILE,
    });

    await hasStartedTodaySession(T0 + DAY);

    const sets = await getAllSets();
    expect(sets.filter((s) => s.sessionId === state.sessionId)).toHaveLength(1);
  });
});

describe('swapExercise', () => {
  it('replaces the exercise in a non-locked slot and persists the change', async () => {
    const today = await loadToday(catalog, PROFILE, T0);
    const slot = today.prescription.exercises.find((e) => e.role !== 'primary')!;
    const replacement = catalog.find((e) => e.id !== slot.exercise.id)!;

    const updated = await swapExercise({
      sessionId: today.sessionId,
      slotId: slot.slotId,
      newExerciseId: replacement.id,
      catalog,
      profile: PROFILE,
      at: T0 + 60_000,
    });

    const swapped = updated.exercises.find((e) => e.slotId === slot.slotId)!;
    expect(swapped.exercise.id).toBe(replacement.id);

    const persisted = await getActivePrescription();
    expect(persisted).toEqual(updated);
  });

  it('leaves every other slot in the prescription untouched', async () => {
    const today = await loadToday(catalog, PROFILE, T0);
    const slot = today.prescription.exercises.find((e) => e.role !== 'primary')!;
    const replacement = catalog.find((e) => e.id !== slot.exercise.id)!;

    const updated = await swapExercise({
      sessionId: today.sessionId,
      slotId: slot.slotId,
      newExerciseId: replacement.id,
      catalog,
      profile: PROFILE,
      at: T0 + 60_000,
    });

    for (const exercise of today.prescription.exercises) {
      if (exercise.slotId === slot.slotId) continue;
      expect(updated.exercises.find((e) => e.slotId === exercise.slotId)).toEqual(exercise);
    }
  });

  it('refuses to swap the locked primary slot', async () => {
    const today = await loadToday(catalog, PROFILE, T0);
    const primary = today.prescription.exercises.find((e) => e.role === 'primary')!;
    const replacement = catalog.find((e) => e.id !== primary.exercise.id)!;

    await expect(
      swapExercise({
        sessionId: today.sessionId,
        slotId: primary.slotId,
        newExerciseId: replacement.id,
        catalog,
        profile: PROFILE,
        at: T0 + 60_000,
      }),
    ).rejects.toThrow(/locked primary/);
  });

  it('rejects a session id that is not the currently active session', async () => {
    const today = await loadToday(catalog, PROFILE, T0);
    const slot = today.prescription.exercises.find((e) => e.role !== 'primary')!;
    const replacement = catalog.find((e) => e.id !== slot.exercise.id)!;

    await expect(
      swapExercise({
        sessionId: 'not-the-active-session',
        slotId: slot.slotId,
        newExerciseId: replacement.id,
        catalog,
        profile: PROFILE,
        at: T0 + 60_000,
      }),
    ).rejects.toThrow(/active session/);
  });
});

describe('completeSession → next loadToday', () => {
  it('advances to the next day in the rotation after a session is completed', async () => {
    const dayIds: string[] = [];

    for (let i = 0; i < 5; i += 1) {
      const at = T0 + i * DAY;
      const today = await loadToday(catalog, PROFILE, at);
      dayIds.push(today.prescription.dayId);
      await completeSession(at + 30 * 60_000);
    }

    expect(dayIds).toEqual(['push', 'pull', 'legs', 'upper', 'lower']);
  });

  it('has no active prescription immediately after completing', async () => {
    const today = await loadToday(catalog, PROFILE, T0);
    await completeSession(T0 + 60_000);
    expect(await getActivePrescription()).toBeUndefined();
    void today;
  });
});
