import { describe, expect, it } from 'vitest';
import { DAY_MS, dayKey, isSameCalendarDay } from '../src/engine/time';

describe('dayKey', () => {
  it('is stable across any two timestamps within the same day', () => {
    const start = 1_700_000_000_000 - (1_700_000_000_000 % DAY_MS);
    expect(dayKey(start)).toBe(dayKey(start + DAY_MS - 1));
  });

  it('differs across a day boundary', () => {
    const start = 1_700_000_000_000 - (1_700_000_000_000 % DAY_MS);
    expect(dayKey(start - 1)).not.toBe(dayKey(start));
  });
});

describe('isSameCalendarDay', () => {
  const start = 1_700_000_000_000 - (1_700_000_000_000 % DAY_MS);

  it('is true for two timestamps in the same day', () => {
    expect(isSameCalendarDay(start, start + 3600_000)).toBe(true);
  });

  it('is false across midnight', () => {
    expect(isSameCalendarDay(start - 1, start)).toBe(false);
  });

  it('is true for an identical timestamp', () => {
    expect(isSameCalendarDay(start, start)).toBe(true);
  });

  it('is false a week apart', () => {
    expect(isSameCalendarDay(start, start + 7 * DAY_MS)).toBe(false);
  });
});
