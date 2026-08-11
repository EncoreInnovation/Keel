/**
 * Turning signed tilt numbers into a sentence a person actually reads.
 *
 * `landmarks.ts` already computes shoulder tilt and hip tilt with a
 * meaningful sign — positive means the right side sits higher — but every
 * screen so far has displayed the bare degree value. A number with no
 * direction attached doesn't answer "which side is worse," which is the
 * actual question behind tracking this at all. This module is the one place
 * that sign gets turned into words, so every caller says the same thing.
 */

import type { PostureAngles, PostureLog } from '../engine/types';

export type TiltSide = 'left' | 'right' | 'level';

/** Below this, the two sides read as level rather than naming a "winner" on noise. */
export const LEVEL_THRESHOLD_DEGREES = 1;

export function tiltSide(degreesValue: number): TiltSide {
  if (Math.abs(degreesValue) < LEVEL_THRESHOLD_DEGREES) return 'level';
  return degreesValue > 0 ? 'right' : 'left';
}

/** "Right hip 2.4° higher" / "Hips level". Works for shoulderTilt or hipTilt. */
export function describeTilt(part: 'shoulder' | 'hip', degreesValue: number): string {
  const side = tiltSide(degreesValue);
  if (side === 'level') return `${part === 'hip' ? 'Hips' : 'Shoulders'} level`;
  const noun = part === 'hip' ? 'hip' : 'shoulder';
  return `${side === 'right' ? 'Right' : 'Left'} ${noun} ${Math.abs(degreesValue).toFixed(1)}° higher`;
}

export type TrendDirection = 'improving' | 'worsening' | 'flat';

/** Whether a signed measurement moved toward or away from level since the last scan. */
export function trendDirection(current: number, previous: number | undefined): TrendDirection {
  if (previous === undefined) return 'flat';
  const delta = Math.abs(current) - Math.abs(previous);
  if (Math.abs(delta) < 0.2) return 'flat';
  return delta < 0 ? 'improving' : 'worsening';
}

export interface AlignmentSummary {
  /** One line for the home screen: the worse of hip/shoulder tilt, named and signed. */
  headline: string;
  /** Which measurement the headline is about, so the tap-through can deep-link to it. */
  focus: 'hip' | 'shoulder' | 'none';
  side: TiltSide;
  trend: TrendDirection;
  daysSinceLastScan: number;
}

/**
 * The single line the home screen shows. Picks whichever of hip/shoulder
 * tilt is currently worse, since that's the one worth a lifter's attention —
 * showing both every time would just be two more numbers to skim past.
 */
export function alignmentSummary(logs: PostureLog[], now: number): AlignmentSummary | undefined {
  if (logs.length === 0) return undefined;

  const sorted = [...logs].sort((a, b) => a.at - b.at);
  const latest = sorted[sorted.length - 1]!;
  const previous = sorted[sorted.length - 2];

  const candidates: { focus: 'hip' | 'shoulder'; value: number; prevValue: number | undefined }[] = [];
  if (latest.angles.hipTilt !== undefined) {
    candidates.push({ focus: 'hip', value: latest.angles.hipTilt, prevValue: previous?.angles.hipTilt });
  }
  if (latest.angles.shoulderTilt !== undefined) {
    candidates.push({
      focus: 'shoulder',
      value: latest.angles.shoulderTilt,
      prevValue: previous?.angles.shoulderTilt,
    });
  }

  const daysSinceLastScan = Math.floor((now - latest.at) / 86_400_000);

  if (candidates.length === 0) {
    return { headline: 'Scan taken, no tilt data yet', focus: 'none', side: 'level', trend: 'flat', daysSinceLastScan };
  }

  const worst = candidates.reduce((a, b) => (Math.abs(a.value) >= Math.abs(b.value) ? a : b));
  const side = tiltSide(worst.value);

  if (side === 'level') {
    return {
      headline: 'Aligned — last checked ' + relativeDays(daysSinceLastScan),
      focus: worst.focus,
      side,
      trend: 'flat',
      daysSinceLastScan,
    };
  }

  const trend = trendDirection(worst.value, worst.prevValue);
  const trendWord = trend === 'improving' ? ' and improving' : trend === 'worsening' ? ' and rising' : '';

  return {
    headline: `${describeTilt(worst.focus, worst.value)}${trendWord}`,
    focus: worst.focus,
    side,
    trend,
    daysSinceLastScan,
  };
}

function relativeDays(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
