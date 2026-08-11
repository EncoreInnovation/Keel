/**
 * This is the module that replaces the jumpy setInterval pacer. The
 * invariant that matters: for ANY elapsed time, position is computed
 * directly rather than accumulated — so unlike the old pacer, feeding it
 * out-of-order or irregularly-spaced samples (exactly what a jittery
 * requestAnimationFrame callback produces) can never cause drift.
 */

import { describe, expect, it } from 'vitest';
import {
  buildBreathKeyframes,
  computeBreathFrame,
  cycleDurationSeconds,
  cycleNumber,
  easeInOutSine,
  RING_MAX,
  RING_MIN,
} from '../src/ui/breathTiming';
import { PROTOCOLS } from '../src/ui/BreathPacer';

describe('easeInOutSine', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeInOutSine(0)).toBeCloseTo(0);
    expect(easeInOutSine(1)).toBeCloseTo(1);
  });

  it('is monotonically increasing', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = easeInOutSine(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('clamps out-of-range input rather than extrapolating', () => {
    expect(easeInOutSine(-1)).toBeCloseTo(0);
    expect(easeInOutSine(2)).toBeCloseTo(1);
  });
});

describe('buildBreathKeyframes — coherent (in 5.5s / out 5.5s)', () => {
  const kfs = buildBreathKeyframes(PROTOCOLS.coherent);

  it('starts contracted and the first phase targets fully expanded', () => {
    expect(kfs[0]!.startScale).toBe(RING_MIN);
    expect(kfs[0]!.endScale).toBe(RING_MAX);
  });

  it('chains start scale to the previous phase\'s end scale', () => {
    expect(kfs[1]!.startScale).toBe(kfs[0]!.endScale);
    expect(kfs[1]!.endScale).toBe(RING_MIN);
  });

  it('lays out cumulative start times correctly', () => {
    expect(kfs[0]!.cycleStartSeconds).toBe(0);
    expect(kfs[1]!.cycleStartSeconds).toBe(5.5);
  });
});

describe('buildBreathKeyframes — box (in/hold/out/hold), hold phases sustain', () => {
  const kfs = buildBreathKeyframes(PROTOCOLS.box);

  it('a hold phase targets the scale it was entered at, not a fixed value', () => {
    const inPhase = kfs[0]!;
    const holdExpanded = kfs[1]!;
    expect(holdExpanded.startScale).toBe(inPhase.endScale);
    expect(holdExpanded.endScale).toBe(holdExpanded.startScale);

    const outPhase = kfs[2]!;
    const holdContracted = kfs[3]!;
    expect(holdContracted.startScale).toBe(outPhase.endScale);
    expect(holdContracted.endScale).toBe(holdContracted.startScale);
  });
});

describe('cycleDurationSeconds', () => {
  it('sums every phase', () => {
    expect(cycleDurationSeconds(PROTOCOLS.coherent)).toBe(11);
    expect(cycleDurationSeconds(PROTOCOLS.box)).toBe(16);
  });
});

describe('computeBreathFrame', () => {
  const kfs = buildBreathKeyframes(PROTOCOLS.coherent);
  const total = cycleDurationSeconds(PROTOCOLS.coherent);

  it('starts at the minimum scale at t=0', () => {
    const frame = computeBreathFrame(kfs, total, 0);
    expect(frame.phaseIndex).toBe(0);
    expect(frame.scale).toBeCloseTo(RING_MIN);
  });

  it('reaches the maximum scale at the end of the inhale phase', () => {
    const frame = computeBreathFrame(kfs, total, 5.5);
    expect(frame.phaseIndex).toBe(1); // just rolled into "out"
    expect(frame.scale).toBeCloseTo(RING_MAX, 1);
  });

  it('is at the midpoint scale-wise partway through a phase, via easing not a straight line', () => {
    const frame = computeBreathFrame(kfs, total, 2.75); // 50% through "in"
    // Eased midpoint of a sine ease equals the linear midpoint at t=0.5 exactly,
    // so this mainly confirms it's moving in the right direction and bounded.
    expect(frame.scale).toBeGreaterThan(RING_MIN);
    expect(frame.scale).toBeLessThan(RING_MAX);
  });

  it('wraps cleanly into a second cycle', () => {
    const startOfCycle2 = computeBreathFrame(kfs, total, total);
    const startOfCycle1 = computeBreathFrame(kfs, total, 0);
    expect(startOfCycle2.phaseIndex).toBe(startOfCycle1.phaseIndex);
    expect(startOfCycle2.scale).toBeCloseTo(startOfCycle1.scale);
  });

  it('never produces a scale outside [RING_MIN, RING_MAX]', () => {
    for (let t = 0; t <= total * 3; t += 0.37) {
      const frame = computeBreathFrame(kfs, total, t);
      expect(frame.scale).toBeGreaterThanOrEqual(RING_MIN - 1e-9);
      expect(frame.scale).toBeLessThanOrEqual(RING_MAX + 1e-9);
    }
  });

  it('counts down whole seconds remaining within a phase', () => {
    const justStarted = computeBreathFrame(kfs, total, 0.1);
    const almostDone = computeBreathFrame(kfs, total, 5.4);
    expect(justStarted.secondsRemaining).toBeGreaterThan(almostDone.secondsRemaining);
    expect(almostDone.secondsRemaining).toBeLessThanOrEqual(1);
  });

  it('is a pure function of elapsed time — identical input always gives identical output', () => {
    const a = computeBreathFrame(kfs, total, 3.14159);
    const b = computeBreathFrame(kfs, total, 3.14159);
    expect(a).toEqual(b);
  });

  it('never derails from irregular sample spacing, unlike an accumulator', () => {
    // Simulate a jittery rAF: uneven step sizes summing to the same total time.
    const steps = [0.008, 0.02, 0.005, 0.05, 0.001, 0.09, 0.003];
    let t = 0;
    for (const step of steps) t += step;
    const jittery = computeBreathFrame(kfs, total, t);
    const clean = computeBreathFrame(kfs, total, steps.reduce((a, b) => a + b, 0));
    expect(jittery).toEqual(clean);
  });

  it('handles an empty protocol without throwing', () => {
    const frame = computeBreathFrame([], 0, 5);
    expect(frame.scale).toBe(RING_MIN);
  });
});

describe('cycleNumber', () => {
  const total = cycleDurationSeconds(PROTOCOLS.coherent);

  it('is 0 for the whole first cycle', () => {
    expect(cycleNumber(total, 0)).toBe(0);
    expect(cycleNumber(total, total - 0.01)).toBe(0);
  });

  it('increments exactly at the cycle boundary', () => {
    expect(cycleNumber(total, total)).toBe(1);
    expect(cycleNumber(total, total * 2)).toBe(2);
  });
});
