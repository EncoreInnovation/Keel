/**
 * A logged Dig Deeper workout, a stair session, a rope session and a sauna
 * all go through the same conditioning path into the fatigue model. These
 * pin down that each one lands where it should — and that the sauna, which
 * isn't training, lands nowhere.
 */

import { describe, expect, it } from 'vitest';
import { applyConditioning, initialFatigueState, recoveryAt, systemicLoad } from '../src/engine/recovery';
import { DD_BY_ID } from '../src/programs/digDeeper';
import type { ConditioningLog } from '../src/engine/types';

const T = 1_800_000_000_000;
const entry = (over: Partial<ConditioningLog>): ConditioningLog => ({
  id: 'c',
  kind: 'dig-deeper',
  startedAt: T,
  durationSec: 45 * 60,
  effort: 7,
  impact: 'low',
  source: 'manual',
  ...over,
});
const after = (log: ConditioningLog) => recoveryAt(applyConditioning(initialFatigueState(T - 1000), log), T + log.durationSec * 1000);

describe('program workouts in the fatigue model', () => {
  it('a Dig Deeper legs day fatigues legs, not chest', () => {
    const r = after(entry({ muscles: DD_BY_ID.get('sd3')!.muscles }));
    expect(r.quads).toBeLessThan(0.5);
    expect(r.glutes).toBeLessThan(0.5);
    expect(r.chest).toBe(1);
  });

  it('a Chest & Back day fatigues chest and back, not legs', () => {
    const r = after(entry({ muscles: DD_BY_ID.get('sd2')!.muscles }));
    expect(r.chest).toBeLessThan(0.5);
    expect(r.lats).toBeLessThan(0.5);
    expect(r.quads).toBe(1);
  });

  it('rope hits the calves hardest', () => {
    const r = after(entry({ kind: 'rope', durationSec: 10 * 60, muscles: undefined, impact: 'moderate' }));
    expect(r.calves).toBeLessThan(r.quads);
  });

  it('a sauna adds no fatigue and no weekly load', () => {
    const sauna = entry({ kind: 'sauna', durationSec: 20 * 60, muscles: undefined, impact: 'none' });
    const r = after(sauna);
    expect(Object.values(r).every((v) => v === 1)).toBe(true);
    expect(systemicLoad([], [sauna], T + 3_600_000)).toBe(0);
  });
});
