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
    expect(normal.sets.length).toBeGreaterThan(1);
    expect(covered.sets.length).toBe(1);
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
    expect(power?.sets.length).toBe(1);
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
