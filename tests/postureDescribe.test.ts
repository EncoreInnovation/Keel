/**
 * This module's whole job is to never invert which side it's blaming. A
 * mislabeled direction here is worse than no label at all — it would send
 * someone toward corrective work for the wrong side of their own body.
 */

import { describe, expect, it } from 'vitest';
import {
  alignmentSummary,
  describeTilt,
  tiltSide,
  trendDirection,
} from '../src/posture/describe';
import type { PostureLog } from '../src/engine/types';

describe('tiltSide', () => {
  it('reads positive as right, negative as left', () => {
    expect(tiltSide(3)).toBe('right');
    expect(tiltSide(-3)).toBe('left');
  });

  it('treats small values as level rather than naming a side on noise', () => {
    expect(tiltSide(0.5)).toBe('level');
    expect(tiltSide(-0.5)).toBe('level');
    expect(tiltSide(0)).toBe('level');
  });
});

describe('describeTilt', () => {
  it('names the higher side for a hip reading', () => {
    expect(describeTilt('hip', 2.4)).toBe('Right hip 2.4° higher');
    expect(describeTilt('hip', -3.1)).toBe('Left hip 3.1° higher');
  });

  it('names the higher side for a shoulder reading', () => {
    expect(describeTilt('shoulder', 1.8)).toBe('Right shoulder 1.8° higher');
  });

  it('reports level cleanly with no side named', () => {
    expect(describeTilt('hip', 0.2)).toBe('Hips level');
    expect(describeTilt('shoulder', -0.1)).toBe('Shoulders level');
  });

  it('never flips sign between input and output', () => {
    for (const v of [-10, -1.5, -0.001, 0.001, 1.5, 10]) {
      const label = describeTilt('hip', v);
      if (Math.abs(v) >= 1) {
        expect(label.startsWith(v > 0 ? 'Right' : 'Left')).toBe(true);
      }
    }
  });
});

describe('trendDirection', () => {
  it('is flat with no previous reading', () => {
    expect(trendDirection(3, undefined)).toBe('flat');
  });

  it('improves when the magnitude shrinks regardless of which side', () => {
    expect(trendDirection(1, 3)).toBe('improving');
    expect(trendDirection(-1, -3)).toBe('improving');
  });

  it('worsens when the magnitude grows', () => {
    expect(trendDirection(4, 2)).toBe('worsening');
  });

  it('is flat for a change too small to mean anything', () => {
    expect(trendDirection(2.05, 2.0)).toBe('flat');
  });
});

function log(id: string, at: number, hipTilt?: number, shoulderTilt?: number): PostureLog {
  return {
    id,
    at,
    views: ['front'],
    angles: { hipTilt, shoulderTilt, lateralShift: 0 } as PostureLog['angles'],
  };
}

describe('alignmentSummary', () => {
  const T0 = 1_700_000_000_000;
  const DAY = 86_400_000;

  it('returns undefined with no scans', () => {
    expect(alignmentSummary([], T0)).toBeUndefined();
  });

  it('picks the worse of hip/shoulder tilt as the headline', () => {
    const summary = alignmentSummary([log('a', T0, 1.5, 4.0)], T0)!;
    expect(summary.focus).toBe('shoulder');
    expect(summary.headline).toContain('shoulder');
  });

  it('names the correct side for a right-high hip', () => {
    const summary = alignmentSummary([log('a', T0, 2.5)], T0)!;
    expect(summary.headline).toContain('Right hip');
  });

  it('names the correct side for a left-high hip', () => {
    const summary = alignmentSummary([log('a', T0, -2.5)], T0)!;
    expect(summary.headline).toContain('Left hip');
  });

  it('reports level when both measurements are near zero', () => {
    const summary = alignmentSummary([log('a', T0, 0.2, -0.3)], T0)!;
    expect(summary.headline).toMatch(/Aligned/);
    expect(summary.side).toBe('level');
  });

  it('adds an improving/rising qualifier based on the trend between the last two scans', () => {
    const improving = alignmentSummary(
      [log('a', T0, 4.0), log('b', T0 + DAY, 2.0)],
      T0 + DAY,
    )!;
    expect(improving.trend).toBe('improving');
    expect(improving.headline).toContain('improving');

    const worsening = alignmentSummary(
      [log('a', T0, 1.0), log('b', T0 + DAY, 3.0)],
      T0 + DAY,
    )!;
    expect(worsening.trend).toBe('worsening');
    expect(worsening.headline).toContain('rising');
  });

  it('reports days since the last scan', () => {
    const summary = alignmentSummary([log('a', T0)], T0 + 9 * DAY)!;
    expect(summary.daysSinceLastScan).toBe(9);
  });

  it('is order-independent — unsorted logs still pick the true latest', () => {
    const inOrder = alignmentSummary([log('a', T0, 4.0), log('b', T0 + DAY, 2.0)], T0 + DAY)!;
    const reversed = alignmentSummary([log('b', T0 + DAY, 2.0), log('a', T0, 4.0)], T0 + DAY)!;
    expect(reversed).toEqual(inOrder);
  });
});
