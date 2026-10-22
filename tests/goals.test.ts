// Node re-reads TZ on every Date call; the app's tsconfig has no Node types.
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'America/New_York';

import { describe, expect, it } from 'vitest';
import { endOfYear, goalProgress, leanMass, resolveGoals } from '../src/engine/goals';
import type { BodyMetricLog, UserProfile } from '../src/engine/types';
import { testProfile } from './support/profile';

const DAY = 86_400_000;
const at = (y: number, m: number, d: number, h = 8) => new Date(y, m - 1, d, h).getTime();
const OCT21 = at(2026, 10, 21);
const NOW = at(2026, 10, 22, 9);
const profile: UserProfile = testProfile();

/** The Oct 21 scale readout. */
const start: BodyMetricLog = { id: 'a', at: OCT21, weight: 284.3, bodyFatPct: 22, visceralFat: 17 };

describe('resolveGoals', () => {
  it('defaults to 250 lb, 15% and Feb 14, due at the end of Dec 31', () => {
    const g = resolveGoals(profile, NOW);
    expect(g.weight).toBe(250);
    expect(g.bodyFatPct).toBe(15);
    expect(g.birthday).toEqual({ month: 2, day: 14 });
    expect(new Date(g.deadline).toString()).toContain('Dec 31 2026 23:59');
  });

  it('keeps goals set in Settings', () => {
    const g = resolveGoals({ ...profile, goalWeight: 260, goalBodyFatPct: 18 }, NOW);
    expect([g.weight, g.bodyFatPct]).toEqual([260, 18]);
  });
});

describe('goalProgress', () => {
  it('sets the starting point from a single weigh-in and says what pace it needs', () => {
    const p = goalProgress([start], profile, NOW)!;
    expect(p.weight!.status).toBe('start');
    expect(p.weight!.neededPerWeek).toBeCloseTo(3.43, 1);
    // Faster than 1%/week, so it shows when 1%/week would get there: Jan 18.
    expect(p.weight!.projection!.basis).toBe('one-percent');
    expect(new Date(p.weight!.projection!.at).toDateString()).toBe('Mon Jan 18 2027');
    expect(p.bodyFat!.status).toBe('start');
    expect(p.visceral).toEqual({ start: 17, latest: 17, direction: 'start' });
  });

  it('is on track when the latest reading sits near the straight line to the goal', () => {
    // Two weeks in, the line is at ~277.6 lb.
    const p = goalProgress([start, { id: 'b', at: OCT21 + 14 * DAY, weight: 278 }], profile, OCT21 + 15 * DAY)!;
    expect(p.weight!.status).toBe('on-track');
    expect(p.weight!.actualPerWeek).toBeCloseTo(3.15, 1);
    expect(p.weight!.projection!.basis).toBe('your-pace');
    expect(p.weight!.tooFast).toBe(true);
  });

  it('is behind or ahead once the gap passes 2 lb', () => {
    const behind = goalProgress([start, { id: 'b', at: OCT21 + 14 * DAY, weight: 281 }], profile, NOW + 14 * DAY)!;
    const ahead = goalProgress([start, { id: 'b', at: OCT21 + 14 * DAY, weight: 274 }], profile, NOW + 14 * DAY)!;
    expect(behind.weight!.status).toBe('behind');
    expect(ahead.weight!.status).toBe('ahead');
  });

  it('uses a 1-point band for body fat, and reports visceral fat by direction', () => {
    const later: BodyMetricLog = { id: 'b', at: OCT21 + 21 * DAY, weight: 276, bodyFatPct: 21.5, visceralFat: 15 };
    const p = goalProgress([start, later], profile, OCT21 + 21 * DAY)!;
    // Line at three weeks is ~19.8%: 21.5 is 1.7 points over.
    expect(p.bodyFat!.status).toBe('behind');
    expect(p.visceral!.direction).toBe('falling');
  });

  it('marks a goal hit', () => {
    const p = goalProgress([start, { id: 'b', at: at(2026, 12, 20), weight: 249.8 }], profile, at(2026, 12, 21))!;
    expect(p.weight!.status).toBe('hit');
    expect(p.weight!.projection).toBeUndefined();
  });

  it('ignores the order entries were saved in', () => {
    const later: BodyMetricLog = { id: 'b', at: OCT21 + 14 * DAY, weight: 278 };
    expect(goalProgress([later, start], profile, NOW)!.weight!.start).toBe(284.3);
  });

  it('has nothing to say after a deadline set in Settings', () => {
    const dated = { ...profile, goalDate: endOfYear(NOW) };
    expect(goalProgress([start], dated, endOfYear(NOW) + 1)).toBeUndefined();
  });

  it('carries the default goals into the next year rather than going blank', () => {
    expect(goalProgress([start], profile, endOfYear(NOW) + 1)!.deadline).toBe(endOfYear(endOfYear(NOW) + 1));
  });
});

describe('leanMass', () => {
  it('matches the scale’s fat-free weight', () => {
    expect(leanMass(start)).toBe(221.8);
    expect(leanMass({ id: 'x', at: 0, weight: 280 })).toBeUndefined();
  });
});
