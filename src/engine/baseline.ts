/**
 * Turning one honest test set into real starting weights.
 *
 * Without this the engine starts every loadable lift at zero and creeps
 * upward, which means the first week or two of training is spent guessing at
 * weights that are far too light to build anything. That's the single most
 * demoralizing failure mode for a physique program: doing sets that obviously
 * aren't hard while the app insists they're the plan.
 *
 * The measurement is deliberately cheap — one set per movement, taken near
 * but not to failure — because a true 1RM test at 290 lb with a postural
 * asymmetry is an injury risk that buys very little extra accuracy.
 */

import { epley1RM } from './overload';
import { resolveLoad } from './loading';
import type { LadderIndex } from './ladders';
import type { Exercise } from './types';

/**
 * Reps left in the tank at a given RPE. RPE 10 means nothing left, RPE 8
 * means about two more were available. This is what lets a submaximal set
 * stand in for a max: a set of 8 at RPE 8 is roughly a 10-rep max.
 */
export function repsInReserve(rpe: number): number {
  return Math.max(0, 10 - rpe);
}

export interface BaselineEntry {
  exerciseId: string;
  weight: number;
  reps: number;
  rpe: number;
}

/**
 * Estimated 1RM from a submaximal set.
 *
 * Reps are extended by the reps left in reserve before going through Epley,
 * so an easy set isn't mistaken for a limit set. A set of 10 @ RPE 7 is
 * treated as a 13-rep effort, which is what it actually was.
 */
export function e1rmFromTestSet(entry: BaselineEntry): number {
  if (entry.weight <= 0 || entry.reps <= 0) return 0;
  const effectiveReps = entry.reps + repsInReserve(entry.rpe);
  return epley1RM(entry.weight, effectiveReps);
}

/**
 * Fraction of 1RM appropriate for a given rep target.
 *
 * Standard percentage table, inverted from Epley so it stays consistent with
 * the rest of the engine rather than introducing a second, disagreeing model
 * of what a rep max means.
 */
export function percentOfMaxForReps(reps: number): number {
  if (reps <= 1) return 1;
  return 1 / (1 + Math.min(reps, 15) / 30);
}

/**
 * The working weight to start a rep range at, snapped to what's loadable.
 *
 * Deliberately conservative: it aims at the TOP of the rep range, so the
 * first working session lands a little light rather than a little heavy.
 * Autoregulation raises it within a session or two, and starting slightly
 * light costs a few days while starting heavy costs a tweaked back.
 */
export function workingWeightFromE1RM(
  e1rm: number,
  repMax: number,
  achievable: number[],
): number {
  if (e1rm <= 0) return 0;
  const target = e1rm * percentOfMaxForReps(repMax);
  return resolveLoad(target, achievable);
}

/* ------------------------------------------------------------------ *
 * Bodyweight ladders
 * ------------------------------------------------------------------ */

/**
 * Where a bodyweight ladder should start, given a max-rep test performed AT a
 * specific rung.
 *
 * The reasoning has to run from the tested movement outward, not upward from
 * the bottom of the chain. The test asks "how many push-ups can you do" — a
 * man who answers 12 has just demonstrated he belongs at push-ups, and any
 * arithmetic that lands him on wall push-ups has misread its own input. That
 * was v1's behaviour and it's the single most demoralizing thing the app did.
 */
export function startingRungFrom(
  tested: Exercise,
  maxReps: number,
  chain: Exercise[],
): Exercise | undefined {
  if (chain.length === 0) return undefined;

  const at = chain.findIndex((e) => e.id === tested.id);
  if (at === -1) return chain[0];

  // Offsets from the rung actually tested. Clearing 20+ reps means the
  // variation has stopped being a strength stimulus; under 4 means it isn't
  // yet one you can train through with clean form.
  let offset = 0;
  if (maxReps >= 20) offset = 1;
  else if (maxReps >= 8) offset = 0;
  else if (maxReps >= 4) offset = -1;
  else offset = -2;

  const index = Math.min(chain.length - 1, Math.max(0, at + offset));
  return chain[index];
}

/**
 * The full easiest-to-hardest chain containing an exercise, walking the
 * `progressionOf` edges the ladder index already inverts.
 */
export function ladderChain(
  start: Exercise,
  index: LadderIndex,
  byId: Map<string, Exercise>,
): Exercise[] {
  // Walk down to the root first so the chain is complete regardless of which
  // rung we were handed.
  let root = start;
  const seenDown = new Set<string>([root.id]);
  while (root.progressionOf) {
    const below = byId.get(root.progressionOf);
    if (!below || seenDown.has(below.id)) break;
    seenDown.add(below.id);
    root = below;
  }

  // The upward walk needs its own guard. Sharing the downward one would make
  // the climb stop dead at whichever rung we were handed, silently truncating
  // the chain for every caller that didn't start at the bottom.
  const chain: Exercise[] = [root];
  const seenUp = new Set<string>([root.id]);
  let cursor = root;
  for (;;) {
    const ups = index.up.get(cursor.id) ?? [];
    const next = ups.map((id) => byId.get(id)).find((e): e is Exercise => Boolean(e));
    if (!next || seenUp.has(next.id)) break;
    seenUp.add(next.id);
    chain.push(next);
    cursor = next;
  }
  return chain;
}
