/**
 * Left/right asymmetry tracking.
 *
 * This is the corrective feature with actual data behind it. A photo can hint
 * that you're shifted right; a logged left-vs-right rep and load gap over
 * twelve weeks either moves or it doesn't. That's a measurement, not a vibe.
 */

import { epley1RM } from './overload';
import type { SetLog, Side } from './types';

export interface SideStats {
  sets: number;
  totalReps: number;
  meanRpe: number;
  bestE1RM: number;
}

export interface AsymmetryReading {
  exerciseId: string;
  left: SideStats;
  right: SideStats;
  /**
   * Signed gap in [-1, 1]. Positive means the right side is stronger, which is
   * the direction expected here. Derived from e1RM when the movement is
   * loaded, and from rep totals when it isn't.
   */
  gap: number;
  /** Gaps beyond this are worth acting on rather than treating as noise. */
  significant: boolean;
}

export const SIGNIFICANT_GAP = 0.1;

function emptyStats(): SideStats {
  return { sets: 0, totalReps: 0, meanRpe: 0, bestE1RM: 0 };
}

function accumulate(stats: SideStats, set: SetLog): SideStats {
  const sets = stats.sets + 1;
  return {
    sets,
    totalReps: stats.totalReps + set.reps,
    meanRpe: (stats.meanRpe * stats.sets + set.rpe) / sets,
    bestE1RM: Math.max(stats.bestE1RM, epley1RM(set.weight, set.reps)),
  };
}

/**
 * Compute the asymmetry reading for one exercise over a window of sets.
 * Bilateral sets are ignored — by construction they say nothing about sides.
 */
export function asymmetryFor(sets: SetLog[], exerciseId: string): AsymmetryReading | undefined {
  let left = emptyStats();
  let right = emptyStats();

  for (const set of sets) {
    if (set.exerciseId !== exerciseId || set.skipped) continue;
    if (set.side === 'left') left = accumulate(left, set);
    else if (set.side === 'right') right = accumulate(right, set);
  }

  if (left.sets === 0 || right.sets === 0) return undefined;

  const useLoad = left.bestE1RM > 0 && right.bestE1RM > 0;
  const l = useLoad ? left.bestE1RM : left.totalReps / left.sets;
  const r = useLoad ? right.bestE1RM : right.totalReps / right.sets;

  const denominator = Math.max(l, r);
  const gap = denominator === 0 ? 0 : (r - l) / denominator;

  return {
    exerciseId,
    left,
    right,
    gap,
    significant: Math.abs(gap) >= SIGNIFICANT_GAP,
  };
}

/** Every exercise with data on both sides, worst gap first. */
export function asymmetryReport(sets: SetLog[]): AsymmetryReading[] {
  const ids = new Set(sets.filter((s) => s.side !== 'both').map((s) => s.exerciseId));
  return [...ids]
    .map((id) => asymmetryFor(sets, id))
    .filter((r): r is AsymmetryReading => Boolean(r))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
}

/**
 * Mean signed gap across all unilateral work — the single number the Progress
 * screen trends over time. Positive is right-dominant.
 */
export function overallGap(readings: AsymmetryReading[]): number {
  if (readings.length === 0) return 0;
  return readings.reduce((sum, r) => sum + r.gap, 0) / readings.length;
}

/**
 * Order the sides so the weaker one goes first.
 *
 * Leading with the weak side and matching the strong side to whatever it
 * managed is the standard way to stop a gap widening. Doing it in the other
 * order is how an asymmetry gets trained in for years.
 */
export function sideOrder(reading: AsymmetryReading | undefined): Side[] {
  if (!reading || !reading.significant) return ['left', 'right'];
  return reading.gap > 0 ? ['left', 'right'] : ['right', 'left'];
}
