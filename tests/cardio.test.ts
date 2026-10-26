// Node re-reads TZ on every Date call; the app's tsconfig has no Node types.
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'America/New_York';

import { describe, expect, it } from 'vitest';
import { cardioMinutesThisWeek, countsAsCardio, weekStart } from '../src/engine/cardio';
import { DD_BY_ID } from '../src/programs/digDeeper';
import type { ConditioningLog } from '../src/engine/types';

const at = (m: number, d: number, h = 9) => new Date(2026, m - 1, d, h).getTime();
const log = (kind: ConditioningLog['kind'], startedAt: number, minutes: number, extra: Partial<ConditioningLog> = {}): ConditioningLog => ({
  id: `${kind}-${startedAt}`,
  kind,
  startedAt,
  durationSec: minutes * 60,
  effort: 7,
  impact: 'low',
  source: 'manual',
  ...extra,
});

describe('weekly cardio minutes', () => {
  it('weeks start on Monday', () => {
    expect(new Date(weekStart(at(11, 1))).toDateString()).toBe('Mon Oct 26 2026'); // a Sunday
    expect(new Date(weekStart(at(11, 2))).toDateString()).toBe('Mon Nov 02 2026');
  });

  it('adds stairs, rope, walks and Dig Deeper cardio — not the sauna or lifting days', () => {
    const logs = [
      log('stairs', at(10, 26, 18), 13),
      log('rope', at(10, 27, 18), 9),
      log('walk', at(10, 28, 7), 30),
      log('dig-deeper', at(10, 31), 25, { muscles: DD_BY_ID.get('dc6')!.muscles, programWorkoutId: 'dc6' }),
      log('dig-deeper', at(10, 30), 45, { muscles: DD_BY_ID.get('dc5')!.muscles, programWorkoutId: 'dc5' }),
      log('sauna', at(10, 30, 19), 15),
    ];
    expect(cardioMinutesThisWeek(logs, at(11, 1, 20))).toBe(77);
  });

  it('starts again from zero on Monday', () => {
    expect(cardioMinutesThisWeek([log('stairs', at(11, 1, 18), 20)], at(11, 2, 8))).toBe(0);
  });

  it('recognises Dig Deeper cardio logged before workout ids were stored', () => {
    expect(countsAsCardio(log('dig-deeper', 0, 25, { muscles: DD_BY_ID.get('sd6')!.muscles }))).toBe(true);
    expect(countsAsCardio(log('dig-deeper', 0, 45, { muscles: DD_BY_ID.get('sd3')!.muscles }))).toBe(false);
  });
});
