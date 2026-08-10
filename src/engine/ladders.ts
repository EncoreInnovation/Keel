/**
 * Progression ladders.
 *
 * This is the mechanic that makes home training actually progress. Without a
 * weight stack, "add 5 lbs" runs out fast — so difficulty is encoded as a
 * directed graph of exercise variants:
 *
 *   wall push-up → incline → knee → full → feet-elevated → deficit → archer → one-arm
 *
 * You climb a rung by earning it, and you climb back down without ceremony
 * when a rung stops being productive. At high bodyweight the entry rungs sit
 * lower than most programs assume, which is the point: the ladder makes the
 * distance between here and a full pull-up visible and finite rather than
 * vague and discouraging.
 */

import type { Exercise, SetLog, Slot } from './types';

export interface LadderIndex {
  /** exerciseId -> the harder rungs directly above it */
  up: Map<string, string[]>;
  /** exerciseId -> the easier rung directly below it */
  down: Map<string, string>;
}

/**
 * Invert `progressionOf` into a bidirectional index. Because the upward edges
 * are derived rather than authored, the two directions cannot drift apart.
 */
export function buildLadderIndex(exercises: Exercise[]): LadderIndex {
  const up = new Map<string, string[]>();
  const down = new Map<string, string>();

  for (const ex of exercises) {
    if (!ex.progressionOf) continue;
    down.set(ex.id, ex.progressionOf);
    const siblings = up.get(ex.progressionOf) ?? [];
    siblings.push(ex.id);
    up.set(ex.progressionOf, siblings);
  }

  return { up, down };
}

export type LadderVerdict = 'advance' | 'hold' | 'regress';

/** Working sets for one exercise within one session, ordered by set index. */
export interface SessionAttempt {
  sessionId: string;
  at: number;
  sets: SetLog[];
}

/**
 * Group an exercise's logged sets into per-session attempts, newest first.
 */
export function attemptsFor(sets: SetLog[], exerciseId: string): SessionAttempt[] {
  const bySession = new Map<string, SetLog[]>();

  for (const set of sets) {
    if (set.exerciseId !== exerciseId || set.skipped) continue;
    const bucket = bySession.get(set.sessionId) ?? [];
    bucket.push(set);
    bySession.set(set.sessionId, bucket);
  }

  return [...bySession.entries()]
    .map(([sessionId, s]) => ({
      sessionId,
      at: Math.max(...s.map((x) => x.completedAt)),
      sets: [...s].sort((a, b) => a.setIndex - b.setIndex),
    }))
    .sort((a, b) => b.at - a.at);
}

/**
 * Did every working set in this attempt clear the top of the rep range at or
 * under the target RPE? That is the bar for "this rung is done".
 *
 * Unilateral work is judged on the *weaker* side. Advancing off the strong
 * side is precisely how an existing asymmetry gets baked in permanently.
 */
export function attemptCleared(attempt: SessionAttempt, slot: Slot): boolean {
  if (attempt.sets.length === 0) return false;

  const byIndex = new Map<number, SetLog[]>();
  for (const set of attempt.sets) {
    const bucket = byIndex.get(set.setIndex) ?? [];
    bucket.push(set);
    byIndex.set(set.setIndex, bucket);
  }

  for (const sides of byIndex.values()) {
    const weakest = sides.reduce((a, b) => (a.reps <= b.reps ? a : b));
    if (weakest.reps < slot.repMax) return false;
    if (weakest.rpe > slot.targetRpe) return false;
  }
  return true;
}

/** Did this attempt fail to reach even the bottom of the rep range? */
export function attemptMissed(attempt: SessionAttempt, slot: Slot): boolean {
  if (attempt.sets.length === 0) return false;
  return attempt.sets.some((set) => set.reps < slot.repMin);
}

/**
 * Two consecutive clears advance; two consecutive misses regress. Requiring
 * two of each is what keeps a single great — or terrible — day from moving
 * you off a rung you haven't actually outgrown.
 */
export function evaluateLadder(attempts: SessionAttempt[], slot: Slot): LadderVerdict {
  const recent = attempts.slice(0, 2);
  if (recent.length < 2) return 'hold';

  if (recent.every((a) => attemptCleared(a, slot))) return 'advance';
  if (recent.every((a) => attemptMissed(a, slot))) return 'regress';
  return 'hold';
}

/**
 * Resolve a verdict into the exercise to use next.
 *
 * Only applies to exercises whose difficulty *is* the variant — loadable
 * movements progress by adding weight instead, handled in `overload.ts`.
 * Where several harder rungs exist, the one requiring no new equipment wins.
 */
export function nextRung(
  current: Exercise,
  verdict: LadderVerdict,
  index: LadderIndex,
  catalog: Map<string, Exercise>,
  availableEquipment: ReadonlySet<string>,
): Exercise {
  if (verdict === 'hold') return current;
  if (current.loadType === 'external') return current;

  if (verdict === 'regress') {
    const downId = index.down.get(current.id);
    const down = downId ? catalog.get(downId) : undefined;
    return down ?? current;
  }

  const candidates = (index.up.get(current.id) ?? [])
    .map((id) => catalog.get(id))
    .filter((ex): ex is Exercise => Boolean(ex))
    .filter((ex) => ex.equipment.every((e) => availableEquipment.has(e)));

  if (candidates.length === 0) return current;

  // Prefer the gentlest step up: fewest pieces of equipment, then lowest impact.
  candidates.sort(
    (a, b) => a.equipment.length - b.equipment.length || a.name.localeCompare(b.name),
  );
  return candidates[0]!;
}

/** How far up its ladder an exercise sits — the number shown on the Progress screen. */
export function rungDepth(exerciseId: string, index: LadderIndex): number {
  let depth = 0;
  let cursor = exerciseId;
  const seen = new Set<string>([cursor]);

  while (true) {
    const below = index.down.get(cursor);
    if (!below || seen.has(below)) break;
    seen.add(below);
    cursor = below;
    depth += 1;
  }
  return depth;
}
