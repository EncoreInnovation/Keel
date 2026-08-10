/**
 * Exercise selection.
 *
 * The block template fixes the *slots* — pattern, sets, rep range, target RPE.
 * This module only decides which exercise fills each slot. That split is what
 * makes the hybrid work: you get Ladder's sense of "week 3 of 6" alongside
 * Fitbod's willingness to route around a fatigued muscle group.
 *
 * The single most important rule lives here: primary lifts are locked for the
 * whole block. Rotating them would feel varied and would silently destroy
 * progressive overload, because you can't progress a lift you keep replacing.
 */

import { impactAtOrBelow, primaryRecovery } from './recovery';
import type {
  Equipment,
  Exercise,
  ImpactLevel,
  Joint,
  MovementPattern,
  MuscleMap,
  Slot,
  UserProfile,
} from './types';

export interface SelectionContext {
  recovery: MuscleMap;
  profile: UserProfile;
  /** Effective impact ceiling — min of earned and user-configured. */
  impactCeiling: ImpactLevel;
  /** Exercise ids used in recent sessions, most recent first. Drives novelty. */
  recentExerciseIds: string[];
  /** exerciseId -> number of logged sessions. Drives the mastery term. */
  historyCounts: Map<string, number>;
  /** Joints the user has flagged as painful, from skip reasons or settings. */
  painFlags: Set<Joint>;
}

export const WEIGHTS = {
  recovery: 0.28,
  pattern: 0.22,
  goal: 0.15,
  corrective: 0.13,
  mastery: 0.12,
  novelty: 0.1,
  jointStress: 0.1,
} as const;

/** How many recent sessions a repeat is penalised across. */
const NOVELTY_WINDOW = 4;

/* ------------------------------------------------------------------ *
 * Hard filters
 * ------------------------------------------------------------------ */

export interface FilterReason {
  exerciseId: string;
  reason: 'equipment' | 'impact' | 'pain' | 'level';
}

const LEVEL_RANK = { novice: 0, intermediate: 1, advanced: 2 } as const;

/**
 * Filters applied before scoring. These are absolute — no amount of goal fit
 * rescues an exercise that needs a barbell you don't own or loads a joint
 * you've flagged as painful.
 */
export function passesHardFilters(
  exercise: Exercise,
  ctx: SelectionContext,
  rejected?: FilterReason[],
): boolean {
  const available = new Set<Equipment>(ctx.profile.availableEquipment);
  if (!exercise.equipment.every((e) => available.has(e))) {
    rejected?.push({ exerciseId: exercise.id, reason: 'equipment' });
    return false;
  }

  if (!impactAtOrBelow(exercise.impact, ctx.impactCeiling)) {
    rejected?.push({ exerciseId: exercise.id, reason: 'impact' });
    return false;
  }

  if (exercise.jointLoad.some((j) => ctx.painFlags.has(j))) {
    rejected?.push({ exerciseId: exercise.id, reason: 'pain' });
    return false;
  }

  // One level above the user's own is allowed — that's where progression
  // lives. Two levels above is just a movement they'll butcher.
  if (LEVEL_RANK[exercise.level] > LEVEL_RANK[ctx.profile.level] + 1) {
    rejected?.push({ exerciseId: exercise.id, reason: 'level' });
    return false;
  }

  return true;
}

/* ------------------------------------------------------------------ *
 * Scoring terms
 * ------------------------------------------------------------------ */

/**
 * Recovery fit, with a steep penalty below 40%. Training a muscle at 30%
 * recovery isn't merely suboptimal — it's the mechanism by which a good
 * program turns into an overuse injury, so the curve punishes it hard rather
 * than treating it as a mild negative.
 */
export function recoveryFit(exercise: Exercise, recovery: MuscleMap): number {
  const mean = primaryRecovery(recovery, exercise);
  if (mean >= 0.4) return mean;
  return mean * (mean / 0.4);
}

export function patternFit(exercise: Exercise, pattern: MovementPattern): number {
  if (!exercise.patterns.includes(pattern)) return 0;
  // A movement that does one thing serves a slot better than a scattershot one.
  return exercise.patterns[0] === pattern ? 1 : 0.75;
}

/**
 * Mastery: enough reps under the bar to progress it confidently. Saturates
 * quickly — the point is to distinguish "known" from "brand new", not to
 * entrench whatever you've done most.
 */
export function masteryBonus(exercise: Exercise, historyCounts: Map<string, number>): number {
  const count = historyCounts.get(exercise.id) ?? 0;
  return Math.min(1, count / 4);
}

/**
 * Novelty: penalise anything used in the last few sessions. Keeps accessory
 * work from going stale, which for an ADHD-shaped brain is a genuine
 * adherence lever rather than a nicety.
 */
export function noveltyBonus(exercise: Exercise, recentExerciseIds: string[]): number {
  const idx = recentExerciseIds.indexOf(exercise.id);
  if (idx === -1 || idx >= NOVELTY_WINDOW) return 1;
  return idx / NOVELTY_WINDOW;
}

/**
 * Soft penalty for loading a joint that's been flagged as merely cranky rather
 * than painful. Hard pain is a filter; this is the gradient below it.
 */
export function jointStressPenalty(exercise: Exercise, painFlags: Set<Joint>): number {
  if (painFlags.size === 0) return 0;
  const overlap = exercise.jointLoad.filter((j) => painFlags.has(j)).length;
  return Math.min(1, overlap / Math.max(1, exercise.jointLoad.length));
}

export function scoreExercise(exercise: Exercise, slot: Slot, ctx: SelectionContext): number {
  const corrective = slot.preferCorrective ? exercise.correctiveFit : exercise.correctiveFit * 0.5;

  return (
    WEIGHTS.recovery * recoveryFit(exercise, ctx.recovery) +
    WEIGHTS.pattern * patternFit(exercise, slot.pattern) +
    WEIGHTS.goal * exercise.goalFit +
    WEIGHTS.corrective * corrective +
    WEIGHTS.mastery * masteryBonus(exercise, ctx.historyCounts) +
    WEIGHTS.novelty * noveltyBonus(exercise, ctx.recentExerciseIds) -
    WEIGHTS.jointStress * jointStressPenalty(exercise, ctx.painFlags)
  );
}

/* ------------------------------------------------------------------ *
 * Selection
 * ------------------------------------------------------------------ */

export interface ScoredExercise {
  exercise: Exercise;
  score: number;
}

/**
 * Rank every eligible candidate for a slot. Ties break on id so that the same
 * inputs always produce the same session — a generator you can't reproduce is
 * a generator you can't test.
 */
export function rankCandidates(
  catalog: Exercise[],
  slot: Slot,
  ctx: SelectionContext,
): ScoredExercise[] {
  return catalog
    .filter((ex) => ex.patterns.includes(slot.pattern))
    .filter((ex) => passesHardFilters(ex, ctx))
    .map((exercise) => ({ exercise, score: scoreExercise(exercise, slot, ctx) }))
    .sort((a, b) => b.score - a.score || a.exercise.id.localeCompare(b.exercise.id));
}

/**
 * Fill a slot.
 *
 * `lockedExerciseId` short-circuits everything for primary slots: once a block
 * has chosen its primary lifts, they hold for all six weeks regardless of what
 * the scorer would prefer today. Losing that guarantee costs you the ability
 * to say whether you got stronger.
 */
export function selectForSlot(
  catalog: Exercise[],
  slot: Slot,
  ctx: SelectionContext,
  lockedExerciseId?: string,
  excludeIds: ReadonlySet<string> = new Set(),
): Exercise | undefined {
  if (slot.locked && lockedExerciseId) {
    const locked = catalog.find((e) => e.id === lockedExerciseId);
    if (locked) return locked;
  }

  const ranked = rankCandidates(catalog, slot, ctx).filter(
    (r) => !excludeIds.has(r.exercise.id),
  );
  return ranked[0]?.exercise;
}

/**
 * Unilateral bias, applied when choosing a block's locked primaries.
 *
 * Bilateral movements let a dominant side quietly do the work; single-leg,
 * single-arm, and offset-loaded variants don't give it anywhere to hide. With
 * a known right-side preference that isn't a stylistic choice — it's the only
 * way the asymmetry shows up in the data at all.
 */
export function unilateralPreference(a: Exercise, b: Exercise): number {
  if (a.unilateral === b.unilateral) return 0;
  return a.unilateral ? -1 : 1;
}
