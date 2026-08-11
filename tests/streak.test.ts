import { describe, expect, it } from 'vitest';
import { currentStreak, sessionsThisWeek } from '../src/engine/streak';

const DAY = 86_400_000;
const T0 = 1_700_000_000_000 - (1_700_000_000_000 % DAY); // aligned to a day boundary

describe('currentStreak', () => {
  it('is zero with no sessions', () => {
    expect(currentStreak([], T0)).toBe(0);
  });

  it('counts a single session today as a streak of one', () => {
    expect(currentStreak([T0], T0)).toBe(1);
  });

  it('counts consecutive days correctly', () => {
    const days = [T0, T0 - DAY, T0 - 2 * DAY, T0 - 3 * DAY];
    expect(currentStreak(days, T0)).toBe(4);
  });

  it('does not break the streak just because today has no session yet', () => {
    const days = [T0 - DAY, T0 - 2 * DAY];
    expect(currentStreak(days, T0)).toBe(2);
  });

  it('breaks on a genuine gap day', () => {
    const days = [T0, T0 - 2 * DAY, T0 - 3 * DAY]; // yesterday missing
    expect(currentStreak(days, T0)).toBe(1);
  });

  it('is zero when the last session was more than a day ago', () => {
    const days = [T0 - 3 * DAY];
    expect(currentStreak(days, T0)).toBe(0);
  });

  it('counts multiple sessions on the same day once', () => {
    expect(currentStreak([T0, T0 + 1000, T0 + 5000], T0)).toBe(1);
  });
});

describe('sessionsThisWeek', () => {
  it('counts sessions within the trailing 7 days', () => {
    const sessions = [T0, T0 - DAY, T0 - 6 * DAY, T0 - 8 * DAY];
    expect(sessionsThisWeek(sessions, T0)).toBe(3);
  });

  it('is zero with nothing in range', () => {
    expect(sessionsThisWeek([T0 - 30 * DAY], T0)).toBe(0);
  });
});
