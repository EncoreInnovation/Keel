/**
 * Weekly cardio minutes, against the 160 a week that improved erectile
 * function in the intervention studies — about 40 minutes of moderate to
 * vigorous aerobic work, four times a week, for six months (Gerbild et al.,
 * Sex Med 2018, systematic review). The same minutes are the heart's
 * minutes: erections and cardiovascular health share their risk factors.
 *
 * Counted: anything aerobic you log or play — stairs, rope, runs, walks,
 * bike, elliptical, circuits, HIIT, Insanity, "other", and Dig Deeper's
 * Steady State Cardio days. Not counted: Dig Deeper lifting days (strength
 * work, not aerobic minutes) and the sauna (heat isn't cardio).
 */

import { DD_BY_ID } from '../programs/digDeeper';
import type { ConditioningKind, ConditioningLog } from './types';

export const WEEKLY_CARDIO_TARGET_MIN = 160;

const AEROBIC: ReadonlySet<ConditioningKind> = new Set<ConditioningKind>([
  'run',
  'walk',
  'bike',
  'elliptical',
  'circuit',
  'hiit',
  'insanity',
  'stairs',
  'rope',
  'other',
]);

const DD_CARDIO_MUSCLES = JSON.stringify(DD_BY_ID.get('dc6')!.muscles);

function isDigDeeperCardio(log: ConditioningLog): boolean {
  if (log.programWorkoutId) return DD_BY_ID.get(log.programWorkoutId)?.kind === 'cardio';
  // Logged before the workout id was stored: the cardio days share one muscle map.
  return JSON.stringify(log.muscles) === DD_CARDIO_MUSCLES;
}

export function countsAsCardio(log: ConditioningLog): boolean {
  if (log.kind === 'dig-deeper') return isDigDeeperCardio(log);
  return AEROBIC.has(log.kind);
}

/** Local midnight of the Monday starting the week that contains `now`. */
export function weekStart(now: number): number {
  const d = new Date(now);
  const sinceMonday = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday).getTime();
}

export function cardioMinutesThisWeek(logs: ConditioningLog[], now: number): number {
  const from = weekStart(now);
  const seconds = logs
    .filter((l) => l.startedAt >= from && l.startedAt <= now && countsAsCardio(l))
    .reduce((sum, l) => sum + l.durationSec, 0);
  return Math.round(seconds / 60);
}
