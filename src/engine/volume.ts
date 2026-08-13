/**
 * Weekly per-muscle volume landmarks.
 *
 * Hypertrophy programming lives or dies on hitting enough hard sets per
 * muscle per week — not effective reps (that's `recovery.ts`'s job, and it
 * answers a different question: "is this muscle fatigued"), just a plain
 * count of working sets against the 10–20 range the literature converges on.
 * A muscle sitting at 4 sets this week is undertrained regardless of how
 * fresh it feels; one sitting at 26 is being driven past the point of
 * returns regardless of how recovered it looks.
 *
 * Primary movers count a full set; secondary movers count at half — the same
 * split `recovery.ts` uses for stimulus, applied here to a landmark that's
 * conventionally stated in sets rather than weighted reps.
 */

import { emptyMuscleMap } from './recovery';
import type { Exercise, MuscleMap, SetLog } from './types';

export const VOLUME_LANDMARK_MIN = 10;
export const VOLUME_LANDMARK_MAX = 20;

const SECONDARY_SET_WEIGHT = 0.5;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Hard sets per muscle in the trailing 7 days ending at `now`.
 *
 * Deliberately ignores everything `recovery.ts` weighs in — RPE, side,
 * decay — because "how many sets did this muscle get this week" and "how
 * fatigued is it right now" are different questions with different answers,
 * and collapsing them would make neither one trustworthy.
 */
export function weeklyMuscleVolume(
  sets: SetLog[],
  catalogById: Map<string, Exercise>,
  now: number,
): MuscleMap {
  const since = now - WEEK_MS;
  const out = emptyMuscleMap();

  for (const set of sets) {
    if (set.skipped) continue;
    if (set.completedAt < since || set.completedAt > now) continue;
    const exercise = catalogById.get(set.exerciseId);
    if (!exercise) continue;

    for (const m of exercise.primaryMuscles) out[m] += 1;
    for (const m of exercise.secondaryMuscles) out[m] += SECONDARY_SET_WEIGHT;
  }

  return out;
}

export type VolumeStatus = 'under' | 'in-range' | 'over';

/** Where a muscle's weekly set count sits relative to the 10–20 landmark. */
export function volumeStatus(weeklySets: number): VolumeStatus {
  if (weeklySets < VOLUME_LANDMARK_MIN) return 'under';
  if (weeklySets > VOLUME_LANDMARK_MAX) return 'over';
  return 'in-range';
}
