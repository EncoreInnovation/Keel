import { describe, expect, it } from 'vitest';
import { adjustRestSeconds, MAX_REST_SECONDS, MIN_REST_SECONDS } from '../src/engine/rest';

describe('adjustRestSeconds', () => {
  it('leaves rest unchanged when the set landed exactly on target RPE', () => {
    expect(adjustRestSeconds(120, 8, 8)).toBe(120);
  });

  it('extends rest after a set that ran harder than target', () => {
    const rest = adjustRestSeconds(120, 9.5, 8);
    expect(rest).toBeGreaterThan(120);
  });

  it('shortens rest after a set that was easier than target', () => {
    const rest = adjustRestSeconds(120, 6, 8);
    expect(rest).toBeLessThan(120);
  });

  it('never drops below the floor even for a very light warm-up set', () => {
    expect(adjustRestSeconds(60, 4, 9)).toBeGreaterThanOrEqual(MIN_REST_SECONDS);
  });

  it('never exceeds the ceiling even for an extreme grinder', () => {
    expect(adjustRestSeconds(150, 10, 6)).toBeLessThanOrEqual(MAX_REST_SECONDS);
  });

  it('is monotonic in the RPE delta', () => {
    const easy = adjustRestSeconds(120, 6, 8);
    const onTarget = adjustRestSeconds(120, 8, 8);
    const hard = adjustRestSeconds(120, 10, 8);
    expect(easy).toBeLessThanOrEqual(onTarget);
    expect(onTarget).toBeLessThanOrEqual(hard);
  });

  it('scales proportionally off the slot base — a finisher and a primary shift by roughly the same factor', () => {
    // Rounding to whole seconds means this is approximate, not exact, at
    // small bases — the invariant that matters is "both grow together",
    // not bit-for-bit identical ratios.
    const finisherBase = 60;
    const primaryBase = 150;
    const finisherHard = adjustRestSeconds(finisherBase, 9.5, 8);
    const primaryHard = adjustRestSeconds(primaryBase, 9.5, 8);
    expect(finisherHard / finisherBase).toBeCloseTo(primaryHard / primaryBase, 1);
  });
});
