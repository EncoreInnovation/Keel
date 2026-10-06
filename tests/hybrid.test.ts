/**
 * The four-day hybrid block: its day copy, its power-dose handling when
 * Insanity already covered the jumping, and Insanity's effect on fatigue.
 */

import { clear } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog/exercises';
import { createBlock, generateSession, HYBRID_BLOCK_DAYS } from '../src/engine/blocks';
import { applyConditioning, initialFatigueState, recoveryAt } from '../src/engine/recovery';
import type { SelectionContext } from '../src/engine/selector';
import type { ConditioningLog, Exercise, MuscleMap } from '../src/engine/types';
import { loadToday } from '../src/state/sessionController';
import { appendConditioningLog } from '../src/storage/repository';
import { keelStore } from '../src/storage/db';
import { cooldownFor, EARLY_MORNING_HOUR, primerFor, PRIMER_COPY, COOLDOWN_COPY } from '../src/ui/phaseCopy';
import { testProfile } from './support/profile';

const T0 = 1_700_000_000_000;
const DAY = 86_400_000;
const catalog = CATALOG as Exercise[];
const profile = testProfile({ impactCeiling: 'high' });

function ctx(): SelectionContext {
  return {
    recovery: Object.fromEntries(
      ['chest', 'upperBack', 'lats', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'lowerBack', 'glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'neck'].map((m) => [m, 1]),
    ) as MuscleMap,
    profile,
    impactCeiling: 'low',
    recentExerciseIds: [],
    historyCounts: new Map(),
    painFlags: new Set(),
  };
}

beforeEach(async () => {
  await clear(keelStore);
});

describe('phase copy', () => {
  it('has a distinct primer and cooldown for every day in the block', () => {
    for (const day of HYBRID_BLOCK_DAYS) {
      expect(PRIMER_COPY[day.id], `primer for ${day.id}`).toBeDefined();
      expect(COOLDOWN_COPY[day.id], `cooldown for ${day.id}`).toBeDefined();
    }
    const titles = new Set(HYBRID_BLOCK_DAYS.map((d) => primerFor(d.id, 14).title));
    expect(titles.size).toBe(HYBRID_BLOCK_DAYS.length);
  });

  it('adds a spine warm-up line only to early-morning primers', () => {
    const morning = primerFor('strength-b', EARLY_MORNING_HOUR - 4);
    const afternoon = primerFor('strength-b', 15);
    expect(morning.lines.length).toBe(afternoon.lines.length + 1);
    expect(morning.lines[0]).toMatch(/spine/i);
    expect(cooldownFor('athletic').title).toMatch(/Calves/);
  });
});

/** Set count per side — a unilateral exercise logs each set once per side. */
function rounds(sets: { side: string }[]): number {
  return sets.filter((s) => s.side === sets[0]!.side).length;
}

describe('power slot vs Insanity', () => {
  function athletic(powerCovered: boolean) {
    const block = createBlock('b', 'Block', HYBRID_BLOCK_DAYS, catalog, ctx(), T0);
    return generateSession({
      block, weekNumber: 2, dayId: 'athletic', catalog, ctx: ctx(), profile, history: [], volumeMultiplier: 1, powerCovered,
    });
  }

  it('programs explosive work first on the athletic day', () => {
    const session = athletic(false);
    expect(session.exercises[0]!.slotId).toBe('d-power');
    expect(session.exercises[0]!.exercise.patterns).toContain('power');
  });

  it('drops power work to one skill set when Insanity already covered the jumping', () => {
    const normal = athletic(false).exercises.find((e) => e.slotId === 'd-power')!;
    const covered = athletic(true).exercises.find((e) => e.slotId === 'd-power')!;
    expect(rounds(normal.sets)).toBeGreaterThan(1);
    expect(rounds(covered.sets)).toBe(1);
  });

  it('loadToday sees an Insanity log from yesterday and covers the power slot', async () => {
    // Walk the rotation to the athletic day (index 3) by completing three sessions.
    const { completeSession } = await import('../src/state/sessionController');
    for (let i = 0; i < 3; i += 1) {
      await loadToday(catalog, profile, T0 + i * DAY);
      await completeSession(T0 + i * DAY + 1_800_000);
    }
    // Week 4 of the block, so the earned impact ceiling admits power work.
    const at = T0 + 22 * DAY;
    const insanity: ConditioningLog = {
      id: 'ins', kind: 'insanity', startedAt: at - 20 * 3_600_000, durationSec: 1800, effort: 8, impact: 'high', source: 'manual',
    };
    await appendConditioningLog(insanity);
    const today = await loadToday(catalog, profile, at);
    expect(today.prescription.dayId).toBe('athletic');
    const power = today.prescription.exercises.find((e) => e.slotId === 'd-power');
    expect(power).toBeDefined();
    expect(rounds(power!.sets)).toBe(1);
  });
});

describe('Insanity in the fatigue model', () => {
  it('hits calves and quads harder than a generic "other" session of the same length', () => {
    const base: Omit<ConditioningLog, 'kind'> = { id: 'x', startedAt: T0, durationSec: 1800, effort: 8, impact: 'high', source: 'manual' };
    const insanity = recoveryAt(applyConditioning(initialFatigueState(T0), { ...base, kind: 'insanity' }), T0 + 60_000);
    const other = recoveryAt(applyConditioning(initialFatigueState(T0), { ...base, kind: 'other' }), T0 + 60_000);
    expect(insanity.calves).toBeLessThan(other.calves);
    expect(insanity.quads).toBeLessThan(other.quads);
  });

  it('a week of daily Insanity trims the next lifting session', async () => {
    const quiet = await loadToday(catalog, profile, T0 + 7 * DAY, 3);
    const quietSets = quiet.prescription.exercises.reduce((n, e) => n + e.sets.length, 0);

    await clear(keelStore);
    for (let d = 0; d < 6; d += 1) {
      await appendConditioningLog({
        id: `ins-${d}`, kind: 'insanity', startedAt: T0 + d * DAY + 6 * 3_600_000, durationSec: 2400, effort: 9, impact: 'high', source: 'manual',
      });
    }
    const busy = await loadToday(catalog, profile, T0 + 7 * DAY, 3);
    const busySets = busy.prescription.exercises.reduce((n, e) => n + e.sets.length, 0);
    expect(busySets).toBeLessThan(quietSets);
  });
});

describe('express mode', () => {
  it('cuts a strength day to about 25 minutes, keeping the locked primary first', async () => {
    const { expressSession } = await import('../src/engine/blocks');
    const block = createBlock('b', 'Block', HYBRID_BLOCK_DAYS, catalog, ctx(), T0);
    const full = generateSession({ block, weekNumber: 2, dayId: 'strength-a', catalog, ctx: ctx(), profile, history: [], volumeMultiplier: 1 });
    const short = expressSession(full);
    expect(short.express).toBe(true);
    expect(short.exercises[0]!.slotId).toBe(full.exercises.find((e) => e.role === 'primary')!.slotId);
    expect(short.exercises.length).toBeLessThanOrEqual(4);
    expect(short.estimatedMinutes).toBeLessThanOrEqual(27);
    expect(short.estimatedMinutes).toBeLessThan(full.estimatedMinutes);
    expect(expressSession(short)).toBe(short);
  });

  it('switches an untouched session to express and back, and refuses once a set is logged', async () => {
    const { setExpress, logSet } = await import('../src/state/sessionController');
    const { getActivePrescription } = await import('../src/storage/repository');
    const today = await loadToday(catalog, profile, T0);
    const short = await setExpress(today.sessionId);
    expect((await getActivePrescription())!.express).toBe(true);
    const restored = await setExpress(today.sessionId, today.prescription);
    expect(restored).toEqual(today.prescription);

    const first = today.prescription.exercises[0]!;
    const slot = today.block.days[0]!.slots.find((s) => s.id === first.slotId)!;
    await logSet(today.sessionId, {
      prescription: today.prescription, slot, exerciseIndex: 0, setIndex: 0, side: first.sets[0]!.side,
      weight: first.sets[0]!.weight, reps: first.sets[0]!.repTarget, rpe: 8, at: T0 + 60_000, profile,
    });
    await expect(setExpress(today.sessionId)).rejects.toThrow(/already started/);
    void short;
  });
});
