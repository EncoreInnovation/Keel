/**
 * Progressive overload and autoregulation.
 *
 * Three timescales, deliberately separated:
 *
 *   within the exercise  — remaining sets re-tune off the set you just did
 *   between sessions     — next session's numbers from smoothed e1RM
 *   across the block     — ladder rungs and the mandatory week-6 deload
 *
 * The target shown in the player is a floor the engine expects, not a ceiling
 * it wants respected. Beating it logs as beating it and pulls the next session
 * up; that is the whole point of logging honestly.
 */

import type { PrescribedSet, SetLog, Slot, UserProfile } from './types';

/* ------------------------------------------------------------------ *
 * One-rep max estimation
 * ------------------------------------------------------------------ */

/**
 * Epley. Accurate enough in the 1–12 rep range that actually gets trained, and
 * degrades gracefully past it. Above ~15 reps the estimate stops meaning much,
 * so we cap its influence rather than pretending otherwise.
 */
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + Math.min(reps, 15) / 30);
}

const E1RM_SMOOTHING = 0.35;

/**
 * Exponentially smoothed e1RM. One heroic — or one dreadful — session should
 * nudge the estimate, not redefine it, otherwise next week's targets whipsaw.
 */
export function updateE1RM(previous: number | undefined, observed: number): number {
  if (!previous) return observed;
  return previous * (1 - E1RM_SMOOTHING) + observed * E1RM_SMOOTHING;
}

/** Best e1RM across a set of logs, ignoring skipped and unloaded work. */
export function bestE1RM(sets: SetLog[]): number {
  let best = 0;
  for (const set of sets) {
    if (set.skipped || set.weight <= 0) continue;
    best = Math.max(best, epley1RM(set.weight, set.reps));
  }
  return best;
}

/* ------------------------------------------------------------------ *
 * Load rounding
 * ------------------------------------------------------------------ */

/**
 * Snap to the increments the user's dumbbells actually have. A prescription of
 * "42.5 lb" to someone with 5 lb jumps isn't precision, it's noise — and it
 * quietly teaches you to ignore the numbers.
 */
export function roundToIncrement(weight: number, increment: number): number {
  if (increment <= 0) return Math.round(weight);
  return Math.round(weight / increment) * increment;
}

/**
 * Reduce a load by a percentage, guaranteeing the result actually moves.
 *
 * Naive rounding breaks here: 50 lb backed off 5% is 47.5, which rounds
 * straight back to 50 on a 5 lb increment. The back-off silently becomes a
 * no-op precisely when it matters — after a grinder — so we force at least
 * one real increment of movement.
 */
export function decreaseWeight(weight: number, factor: number, increment: number): number {
  if (weight <= 0) return 0;
  const rounded = roundToIncrement(weight * factor, increment);
  if (rounded < weight) return rounded;
  return Math.max(0, weight - Math.max(increment, 1));
}

/** Mirror of `decreaseWeight`: always add at least one usable increment. */
export function increaseWeight(weight: number, factor: number, increment: number): number {
  const rounded = roundToIncrement(weight * factor, increment);
  if (rounded > weight) return rounded;
  return weight + Math.max(increment, 1);
}

/* ------------------------------------------------------------------ *
 * Between sessions — double progression
 * ------------------------------------------------------------------ */

export interface ProgressionInput {
  slot: Slot;
  /** Most recent completed attempt at this exercise, ordered by set index. */
  lastAttempt: SetLog[];
  profile: UserProfile;
  /** Whether the exercise's difficulty comes from load or from the variant. */
  loadable: boolean;
}

export interface ProgressionResult {
  weight: number;
  repTarget: number;
  /** Explains the change in one short line, surfaced in the UI. */
  rationale: string;
}

/**
 * Double progression: climb the rep range at a fixed load, then add load and
 * drop back to the bottom of the range.
 */
export function nextPrescription(input: ProgressionInput): ProgressionResult {
  const { slot, lastAttempt, profile, loadable } = input;

  const working = lastAttempt.filter((s) => !s.skipped);
  if (working.length === 0) {
    return { weight: 0, repTarget: slot.repMin, rationale: 'First time — find a working load.' };
  }

  // Judge the session on its weakest set: the last set is where a load is
  // actually tested, and on unilateral work the weaker side is the honest one.
  const weakest = working.reduce((a, b) => (a.reps <= b.reps ? a : b));
  const lastWeight = working[working.length - 1]!.weight;
  const maxRpe = Math.max(...working.map((s) => s.rpe));

  const clearedTop = weakest.reps >= slot.repMax && maxRpe <= slot.targetRpe;
  const missedBottom = weakest.reps < slot.repMin;
  const overshotRpe = maxRpe > slot.targetRpe + 1;

  if (!loadable) {
    // Unloaded work progresses by reps until the ladder takes over.
    if (clearedTop) {
      return {
        weight: 0,
        repTarget: slot.repMax,
        rationale: 'Top of range cleared — ready to move up a rung.',
      };
    }
    if (missedBottom) {
      return { weight: 0, repTarget: slot.repMin, rationale: 'Holding to rebuild the range.' };
    }
    return {
      weight: 0,
      repTarget: Math.min(slot.repMax, weakest.reps + 1),
      rationale: 'One more rep than last time.',
    };
  }

  if (clearedTop) {
    return {
      weight: increaseWeight(lastWeight, 1.05, profile.dumbbellIncrement),
      repTarget: slot.repMin,
      rationale: 'Cleared the range — load up.',
    };
  }

  if (missedBottom || overshotRpe) {
    return {
      weight: decreaseWeight(lastWeight, 0.95, profile.dumbbellIncrement),
      repTarget: slot.repMin,
      rationale: overshotRpe
        ? 'Ran hotter than target — backing off.'
        : 'Missed the range — backing off.',
    };
  }

  return {
    weight: lastWeight,
    repTarget: Math.min(slot.repMax, weakest.reps + 1),
    rationale: 'Same load, one more rep.',
  };
}

/* ------------------------------------------------------------------ *
 * Within the exercise — in-session autoregulation
 * ------------------------------------------------------------------ */

export type InSessionAction = 'increase' | 'hold' | 'decrease' | 'offerRegression';

export interface InSessionAdjustment {
  action: InSessionAction;
  remaining: PrescribedSet[];
  message?: string;
}

/**
 * Re-tune the sets still ahead of you based on the one just logged.
 *
 * Bounded on purpose. This nudges by one increment or 5–10%; it never rewrites
 * the session. A player that lurches around after every set is one you stop
 * trusting, and trust is the entire currency here.
 */
export function adjustRemainingSets(
  justCompleted: SetLog,
  remaining: PrescribedSet[],
  slot: Slot,
  profile: UserProfile,
  consecutiveMisses: number,
): InSessionAdjustment {
  if (remaining.length === 0) return { action: 'hold', remaining };

  const overshot = justCompleted.reps >= slot.repMax + 2 && justCompleted.rpe <= slot.targetRpe - 1;
  const struggled = justCompleted.reps < slot.repMin - 2 || justCompleted.rpe >= 9.5;

  if (consecutiveMisses >= 2) {
    return {
      action: 'offerRegression',
      remaining,
      message: 'Two hard misses — want an easier variation?',
    };
  }

  if (overshot) {
    return {
      action: 'increase',
      remaining: remaining.map((s) => ({
        ...s,
        weight: s.weight > 0 ? s.weight + profile.dumbbellIncrement : 0,
        repTarget: s.weight > 0 ? s.repTarget : Math.min(slot.repMax + 4, s.repTarget + 2),
      })),
      message: 'That was light — nudging the rest up.',
    };
  }

  if (struggled) {
    return {
      action: 'decrease',
      remaining: remaining.map((s) => ({
        ...s,
        weight: s.weight > 0 ? decreaseWeight(s.weight, 0.9, profile.dumbbellIncrement) : 0,
        repTarget: s.weight > 0 ? s.repTarget : Math.max(1, s.repTarget - 2),
      })),
      message: 'Backing the rest off so you finish the session.',
    };
  }

  return { action: 'hold', remaining };
}

/* ------------------------------------------------------------------ *
 * Across the block — deload
 * ------------------------------------------------------------------ */

export const DELOAD_VOLUME_FACTOR = 0.6; // −40% sets
export const DELOAD_INTENSITY_FACTOR = 0.9; // −10% load

export function isDeloadWeek(weekNumber: number, deloadWeek: number): boolean {
  return weekNumber === deloadWeek;
}

/**
 * Apply the deload. Not skippable, and not negotiable: "push hard with no
 * deloads" is the reliable route to week nine with a hurt back — which costs
 * far more training time than the light week ever would.
 */
export function applyDeload(sets: PrescribedSet[], increment: number): PrescribedSet[] {
  const keep = Math.max(1, Math.round(sets.length * DELOAD_VOLUME_FACTOR));
  return sets.slice(0, keep).map((s) => ({
    ...s,
    weight: decreaseWeight(s.weight, DELOAD_INTENSITY_FACTOR, increment),
    targetRpe: Math.min(s.targetRpe, 7),
  }));
}
