/**
 * Per-muscle recovery model.
 *
 * Two ideas do all the work here:
 *
 *  1. Stimulus is measured in *effective reps* — reps weighted by proximity to
 *     failure — not raw volume. Three sets of 10 at RPE 6 and three sets of 10
 *     at RPE 9 are not the same event, and a model that treats them alike will
 *     happily bury you.
 *
 *  2. Fatigue decays exponentially with a muscle-size-dependent half-life,
 *     which lands large muscles near-recovered around 72h and small ones
 *     around 48h — the window the training literature actually supports.
 *
 * Conditioning feeds the same state. Without that, the engine would cheerfully
 * prescribe heavy squats the morning after a long trail run.
 */

import {
  LARGE_MUSCLES,
  MUSCLES,
  type ConditioningLog,
  type Exercise,
  type ImpactLevel,
  type Muscle,
  type MuscleMap,
  type SetLog,
} from './types';

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

/**
 * Reference weekly effective-rep volume per muscle. This is the denominator
 * that converts raw stimulus into a 0..1 fatigue fraction, and it is why a set
 * of curls doesn't fatigue biceps the way a set of squats fatigues quads.
 */
export const MRV_REF: MuscleMap = {
  chest: 55,
  upperBack: 55,
  lats: 55,
  shoulders: 40,
  biceps: 32,
  triceps: 38,
  forearms: 30,
  abs: 40,
  lowerBack: 45,
  glutes: 65,
  quads: 65,
  hamstrings: 55,
  calves: 35,
  adductors: 35,
  neck: 22,
};

export const HALF_LIFE_LARGE_H = 30;
export const HALF_LIFE_SMALL_H = 20;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Contribution of a secondary (assisting) muscle relative to a primary one. */
const SECONDARY_ROLE_WEIGHT = 0.5;

/**
 * Unilateral sets contribute at half weight.
 *
 * Muscles are modelled as one bilateral pool per group, but a single-arm row
 * only fatigues the side doing the work. Counting both sides at full weight
 * double-charges the pool and makes any unilateral-biased programme look like
 * overtraining that isn't happening — which matters here, because the
 * unilateral bias is deliberate.
 */
const UNILATERAL_ROLE_WEIGHT = 0.5;

/** Joint load from impact work decays over roughly a week. */
const JOINT_LOAD_HALF_LIFE_H = 60;

export function halfLifeFor(muscle: Muscle): number {
  return LARGE_MUSCLES.has(muscle) ? HALF_LIFE_LARGE_H : HALF_LIFE_SMALL_H;
}

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

export interface FatigueState {
  /** 0..1 per muscle. 1 means maximally fatigued. */
  fatigue: MuscleMap;
  /** Timestamp the fatigue values are valid as of. */
  at: number;
  /**
   * Accumulated ground-impact exposure. Gates plyometric progression — at high
   * bodyweight this is the difference between a training block and an injury.
   */
  jointLoad: number;
}

export function emptyMuscleMap(): MuscleMap {
  return Object.fromEntries(MUSCLES.map((m) => [m, 0])) as MuscleMap;
}

export function initialFatigueState(at: number): FatigueState {
  return { fatigue: emptyMuscleMap(), at, jointLoad: 0 };
}

/* ------------------------------------------------------------------ *
 * Stimulus
 * ------------------------------------------------------------------ */

/**
 * Effective-rep weighting. RPE 5 and below is warmup territory and barely
 * counts; RPE 10 counts fully. Deliberately floors at 0.2 rather than 0 so
 * that genuinely easy volume still registers as *something*.
 */
export function rpeFactor(rpe: number): number {
  return Math.min(1, Math.max(0.2, (rpe - 5) / 5));
}

export function setStimulus(set: SetLog): number {
  if (set.skipped) return 0;
  return set.reps * rpeFactor(set.rpe);
}

/**
 * Advance fatigue to a later timestamp. Pure — returns a new state.
 * Called before every read, so displayed recovery is always current.
 */
export function decayTo(state: FatigueState, at: number): FatigueState {
  const elapsedH = (at - state.at) / HOUR_MS;
  if (elapsedH <= 0) return state;

  const fatigue = emptyMuscleMap();
  for (const m of MUSCLES) {
    fatigue[m] = state.fatigue[m] * Math.pow(0.5, elapsedH / halfLifeFor(m));
  }

  return {
    fatigue,
    at,
    jointLoad: state.jointLoad * Math.pow(0.5, elapsedH / JOINT_LOAD_HALF_LIFE_H),
  };
}

/**
 * Fold a completed set into fatigue state. Decays to the set's completion time
 * first so that sets applied out of order still produce the same result.
 */
export function applySet(
  state: FatigueState,
  set: SetLog,
  exercise: Exercise,
): FatigueState {
  const next = decayTo(state, Math.max(state.at, set.completedAt));
  const stimulus = setStimulus(set);
  if (stimulus === 0) return next;

  const sideWeight = set.side === 'both' ? 1 : UNILATERAL_ROLE_WEIGHT;
  const effective = stimulus * sideWeight;

  const fatigue = { ...next.fatigue };

  for (const m of exercise.primaryMuscles) {
    fatigue[m] = Math.min(1, fatigue[m] + effective / MRV_REF[m]);
  }
  for (const m of exercise.secondaryMuscles) {
    fatigue[m] = Math.min(1, fatigue[m] + (effective * SECONDARY_ROLE_WEIGHT) / MRV_REF[m]);
  }

  return { ...next, fatigue };
}

/* ------------------------------------------------------------------ *
 * Conditioning
 * ------------------------------------------------------------------ */

/** Stimulus per minute delivered to each muscle, by activity kind. */
const CONDITIONING_PROFILE: Record<ConditioningLog['kind'], Partial<MuscleMap>> = {
  run: { quads: 0.8, hamstrings: 0.6, calves: 1.0, glutes: 0.4, lowerBack: 0.15 },
  walk: { quads: 0.2, calves: 0.3, glutes: 0.15, hamstrings: 0.1 },
  bike: { quads: 0.7, glutes: 0.35, calves: 0.2, hamstrings: 0.2 },
  circuit: {
    quads: 0.4,
    glutes: 0.3,
    hamstrings: 0.25,
    chest: 0.25,
    shoulders: 0.25,
    abs: 0.35,
    triceps: 0.2,
    upperBack: 0.2,
  },
  hiit: {
    quads: 0.7,
    glutes: 0.5,
    hamstrings: 0.4,
    calves: 0.5,
    abs: 0.4,
    shoulders: 0.2,
    chest: 0.2,
  },
  other: { quads: 0.3, glutes: 0.2, abs: 0.2, shoulders: 0.15 },
};

const IMPACT_WEIGHT: Record<ImpactLevel, number> = {
  none: 0,
  low: 0.5,
  moderate: 1.2,
  high: 2.5,
};

export const IMPACT_ORDER: ImpactLevel[] = ['none', 'low', 'moderate', 'high'];

/**
 * Fold a conditioning session into the same fatigue state as lifting. Effort
 * scales the profile against a nominal moderate effort of 6.
 */
export function applyConditioning(state: FatigueState, log: ConditioningLog): FatigueState {
  const at = log.startedAt + log.durationSec * 1000;
  const next = decayTo(state, Math.max(state.at, at));

  const minutes = log.durationSec / 60;
  const effortScale = Math.max(0.3, log.effort / 6);
  const profile = CONDITIONING_PROFILE[log.kind];

  const fatigue = { ...next.fatigue };
  for (const [muscle, perMinute] of Object.entries(profile) as [Muscle, number][]) {
    const stimulus = minutes * perMinute * effortScale;
    fatigue[muscle] = Math.min(1, fatigue[muscle] + stimulus / MRV_REF[muscle]);
  }

  const jointLoad = next.jointLoad + minutes * IMPACT_WEIGHT[log.impact] * effortScale;

  return { fatigue, at: next.at, jointLoad };
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

/** 0..1 per muscle, where 1 is fully recovered. What the body map renders. */
export function recoveryAt(state: FatigueState, at: number): MuscleMap {
  const decayed = decayTo(state, at);
  const out = emptyMuscleMap();
  for (const m of MUSCLES) out[m] = 1 - decayed.fatigue[m];
  return out;
}

/** Mean recovery across an exercise's primary movers — the selector's main input. */
export function primaryRecovery(recovery: MuscleMap, exercise: Exercise): number {
  const muscles = exercise.primaryMuscles;
  if (muscles.length === 0) return 1;
  return muscles.reduce((sum, m) => sum + recovery[m], 0) / muscles.length;
}

/**
 * Whole-body load over the trailing week, normalised to roughly 0..1.
 * Combined with subjective readiness to scale today's prescribed volume.
 */
export function systemicLoad(
  sets: { set: SetLog; exercise: Exercise }[],
  conditioning: ConditioningLog[],
  now: number,
): number {
  const since = now - 7 * DAY_MS;

  let total = 0;
  for (const { set } of sets) {
    if (set.completedAt >= since) total += setStimulus(set);
  }
  for (const c of conditioning) {
    if (c.startedAt >= since) total += (c.durationSec / 60) * Math.max(0.3, c.effort / 6) * 0.9;
  }

  // ~700 effective reps/week is a hard but sustainable week for this profile.
  return Math.min(1.5, total / 700);
}

/**
 * Volume multiplier for today's session, in [0.8, 1.2].
 *
 * Readiness (1..5, self-reported) and accumulated systemic load pull in
 * opposite directions. Capped tightly: this nudges a session, it does not
 * redesign it. Wild swings would undermine the point of having a block.
 */
export function volumeMultiplier(load: number, readiness: number | undefined): number {
  const loadTerm = (0.6 - load) * 0.35;
  const readinessTerm = readiness === undefined ? 0 : ((readiness - 3) / 2) * 0.15;
  return Math.min(1.2, Math.max(0.8, 1 + loadTerm + readinessTerm));
}

/**
 * Highest impact level the accumulated joint-load history supports.
 *
 * Deliberately conservative: impact work is earned by demonstrating tolerance
 * for the tier below it, never selected off a menu. The user's configured
 * ceiling caps this further.
 */
export function earnedImpactCeiling(jointLoad: number, weeksTrained: number): ImpactLevel {
  if (weeksTrained < 3) return 'none';
  if (weeksTrained < 6 || jointLoad < 20) return 'low';
  if (weeksTrained < 10 || jointLoad < 60) return 'moderate';
  return 'high';
}

export function impactAtOrBelow(level: ImpactLevel, ceiling: ImpactLevel): boolean {
  return IMPACT_ORDER.indexOf(level) <= IMPACT_ORDER.indexOf(ceiling);
}
