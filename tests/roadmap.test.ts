import { describe, expect, it } from 'vitest';
import { buildRoadmap, currentWeekIndex, daysUntil, holidayEvents } from '../src/engine/roadmap';

// Wednesday 7 October 2026, local time — the planned Q4 start.
const START = new Date(2026, 9, 7, 6, 30).getTime();
const DAY = 86_400_000;

describe('Q4 roadmap', () => {
  const weeks = buildRoadmap(START);

  it('is two six-week blocks plus a retest week', () => {
    expect(weeks).toHaveLength(13);
    expect(weeks.filter((w) => w.phase === 'deload').map((w) => w.index)).toEqual([5, 11]);
    expect(weeks.at(-1)!.phase).toBe('retest');
  });

  it('puts Thanksgiving 2026 (26 Nov) in block 2 week 2 and Christmas in the block 2 deload', () => {
    const tg = holidayEvents(2026).find((e) => e.label === 'Thanksgiving')!;
    expect(new Date(tg.at).getDate()).toBe(26);
    const tgWeek = weeks.find((w) => w.events.includes('Thanksgiving'))!;
    expect([tgWeek.block, tgWeek.weekInBlock]).toEqual([2, 2]);
    const xmas = weeks.find((w) => w.events.includes('Christmas'))!;
    expect(xmas.phase).toBe('deload');
  });

  it('finds the current week and clamps outside the plan', () => {
    expect(currentWeekIndex(weeks, START + 2 * DAY)).toBe(0);
    expect(currentWeekIndex(weeks, START + 15 * DAY)).toBe(2);
    expect(currentWeekIndex(weeks, START - 30 * DAY)).toBe(0);
    expect(currentWeekIndex(weeks, START + 400 * DAY)).toBe(12);
  });

  it('counts whole days to a date and never goes negative', () => {
    expect(daysUntil(START + 3 * DAY, START)).toBe(3);
    expect(daysUntil(START - DAY, START)).toBe(0);
  });
});
