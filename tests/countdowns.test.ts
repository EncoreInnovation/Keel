/**
 * Countdowns are calendar days in the phone's local time — pinned here to
 * Eastern, where the app is actually used, so the DST case is real.
 */

// Node re-reads TZ on every Date call; the app's tsconfig has no Node types.
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'America/New_York';

import { describe, expect, it } from 'vitest';
import { countdowns } from '../src/engine/countdowns';

const at = (y: number, m: number, d: number, h = 8, min = 48) => new Date(y, m - 1, d, h, min).getTime();
const days = (now: number) => Object.fromEntries(countdowns(now).map((c) => [c.id, c.days]));

describe('countdowns', () => {
  it('counts from Oct 22, 8:48 am', () => {
    expect(days(at(2026, 10, 22))).toEqual({ q4: 70, birthday: 115, spring: 149, summer: 242 });
  });

  it('gives the same count late at night as first thing in the morning', () => {
    expect(days(at(2026, 10, 22, 23, 59))).toEqual(days(at(2026, 10, 22, 0, 1)));
  });

  it("isn't thrown off by the clocks going back on Nov 1", () => {
    expect(days(at(2026, 11, 2)).q4).toBe(59);
    expect(days(at(2026, 10, 31)).q4).toBe(61);
  });

  it('reads 0 on the day itself and rolls to next year the day after', () => {
    expect(days(at(2027, 2, 14)).birthday).toBe(0);
    expect(days(at(2027, 2, 15)).birthday).toBe(364);
    expect(days(at(2026, 12, 31)).q4).toBe(0);
  });

  it('only shows Q4 during Q4', () => {
    expect(days(at(2027, 1, 5)).q4).toBeUndefined();
    expect(days(at(2026, 9, 30)).q4).toBeUndefined();
    expect(days(at(2026, 10, 1)).q4).toBe(91);
  });

  it('uses a birthday from the profile', () => {
    const c = countdowns(at(2026, 10, 22), { month: 11, day: 1 });
    expect(c.find((x) => x.id === 'birthday')!.days).toBe(10);
  });
});
