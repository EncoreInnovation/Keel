/**
 * Progress toward the dated body goals (by default ≤250 lb and ≤15% body fat
 * by Dec 31).
 *
 * "On track" is judged against a straight line from the first weigh-in to
 * the goal on its deadline. Tolerances are wide on purpose — 2 lb and 1 point
 * of body fat — because water alone moves a scale that much day to day, and
 * a status that flips on noise teaches you to ignore it.
 *
 * When the goal needs more than 1% of bodyweight a week, the app says so and
 * shows when 1% a week would get there: past that rate, on top of lifting and
 * Insanity, the weight lost starts including muscle.
 */

import type { BodyMetricLog, UserProfile } from './types';
import { DEFAULT_BIRTHDAY } from './countdowns';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
/** Two weigh-ins closer than this are the same data point as far as pace goes. */
const MIN_TREND_SPAN_MS = 6 * DAY_MS;
/** The fastest weekly loss, as a fraction of bodyweight, that protects muscle. */
export const SAFE_WEEKLY_LOSS = 0.01;

export const DEFAULT_GOAL_WEIGHT = 250;
export const DEFAULT_GOAL_BODY_FAT = 15;

export interface ResolvedGoals {
  deadline: number;
  weight: number;
  bodyFatPct: number;
  birthday: { month: number; day: number };
}

/** End of Dec 31 in the year `now` falls in. */
export function endOfYear(now: number): number {
  return new Date(new Date(now).getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
}

/** The profile's goals, with the defaults filled in for anything never set. */
export function resolveGoals(profile: UserProfile, now: number): ResolvedGoals {
  return {
    deadline: profile.goalDate ?? endOfYear(now),
    weight: profile.goalWeight ?? DEFAULT_GOAL_WEIGHT,
    bodyFatPct: profile.goalBodyFatPct ?? DEFAULT_GOAL_BODY_FAT,
    birthday: profile.birthday ?? DEFAULT_BIRTHDAY,
  };
}

export type GoalStatus = 'start' | 'on-track' | 'ahead' | 'behind' | 'hit';

export interface MetricGoal {
  start: number;
  startAt: number;
  latest: number;
  latestAt: number;
  target: number;
  status: GoalStatus;
  /** Loss per week still needed, from the latest reading to the deadline. */
  neededPerWeek: number;
  /** Loss per week so far; undefined until two readings are far enough apart. */
  actualPerWeek?: number;
  /**
   * When the target is reached at a believable pace: your own once there's a
   * trend, otherwise 1% of bodyweight a week (weight only).
   */
  projection?: { at: number; basis: 'your-pace' | 'one-percent' };
  /** Losing faster than 1% of bodyweight a week (weight only). */
  tooFast: boolean;
}

export interface GoalProgress {
  deadline: number;
  weight?: MetricGoal;
  bodyFat?: MetricGoal;
  visceral?: { start: number; latest: number; direction: 'start' | 'falling' | 'flat' | 'rising' };
}

function series(metrics: BodyMetricLog[], pick: (m: BodyMetricLog) => number | undefined) {
  return [...metrics]
    .sort((a, b) => a.at - b.at)
    .flatMap((m) => {
      const value = pick(m);
      return value === undefined ? [] : [{ at: m.at, value }];
    });
}

function metricGoal(
  points: { at: number; value: number }[],
  target: number,
  deadline: number,
  now: number,
  tolerance: number,
  isWeight: boolean,
): MetricGoal | undefined {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return undefined;

  const weeksLeft = Math.max(1 / 7, (deadline - now) / WEEK_MS);
  const neededPerWeek = Math.max(0, (last.value - target) / weeksLeft);
  const span = last.at - first.at;
  const hasTrend = span >= MIN_TREND_SPAN_MS;
  const actualPerWeek = hasTrend ? (first.value - last.value) / (span / WEEK_MS) : undefined;

  let status: GoalStatus;
  if (last.value <= target) status = 'hit';
  else if (!hasTrend) status = 'start';
  else {
    const share = Math.min(1, (last.at - first.at) / Math.max(1, deadline - first.at));
    const expected = first.value + (target - first.value) * share;
    const gap = last.value - expected;
    status = Math.abs(gap) <= tolerance ? 'on-track' : gap < 0 ? 'ahead' : 'behind';
  }

  let projection: MetricGoal['projection'];
  if (status !== 'hit') {
    if (actualPerWeek !== undefined && actualPerWeek > 0) {
      projection = { at: last.at + ((last.value - target) / actualPerWeek) * WEEK_MS, basis: 'your-pace' };
    } else if (isWeight && neededPerWeek > last.value * SAFE_WEEKLY_LOSS) {
      const weeks = Math.log(target / last.value) / Math.log(1 - SAFE_WEEKLY_LOSS);
      projection = { at: last.at + weeks * WEEK_MS, basis: 'one-percent' };
    }
  }

  return {
    start: first.value,
    startAt: first.at,
    latest: last.value,
    latestAt: last.at,
    target,
    status,
    neededPerWeek,
    actualPerWeek,
    projection,
    tooFast: isWeight && actualPerWeek !== undefined && actualPerWeek > last.value * SAFE_WEEKLY_LOSS,
  };
}

export function goalProgress(metrics: BodyMetricLog[], profile: UserProfile, now: number): GoalProgress | undefined {
  const goals = resolveGoals(profile, now);
  if (now > goals.deadline) return undefined;

  const visceralPoints = series(metrics, (m) => m.visceralFat);
  let visceral: GoalProgress['visceral'];
  if (visceralPoints.length > 0) {
    const start = visceralPoints[0]!.value;
    const latest = visceralPoints.at(-1)!.value;
    const d = latest - start;
    visceral = {
      start,
      latest,
      direction: visceralPoints.length < 2 ? 'start' : d <= -0.5 ? 'falling' : d >= 0.5 ? 'rising' : 'flat',
    };
  }

  return {
    deadline: goals.deadline,
    weight: metricGoal(series(metrics, (m) => m.weight), goals.weight, goals.deadline, now, 2, true),
    bodyFat: metricGoal(series(metrics, (m) => m.bodyFatPct), goals.bodyFatPct, goals.deadline, now, 1, false),
    visceral,
  };
}

/** Fat-free mass from a weigh-in, when it has both numbers. */
export function leanMass(m: BodyMetricLog): number | undefined {
  if (m.weight === undefined || m.bodyFatPct === undefined) return undefined;
  return Math.round(m.weight * (1 - m.bodyFatPct / 100) * 10) / 10;
}
