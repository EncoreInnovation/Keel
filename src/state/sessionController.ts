/**
 * Session orchestration.
 *
 * Everything in `src/engine` is pure and everything in `src/storage` is a
 * thin IndexedDB wrapper; neither knows the other exists. This module is the
 * seam — it builds the engine's `SelectionContext` from what's on disk,
 * decides whether today's session already exists (resume) or needs
 * generating (fresh), and turns a logged set into the three-timescale
 * autoregulation the plan specifies: this exercise's remaining sets, this
 * session's targets, and the persisted record either way.
 */

import {
  applyConditioning,
  applySet,
  earnedImpactCeiling,
  initialFatigueState,
  recoveryAt,
  systemicLoad,
  volumeMultiplier,
  type FatigueState,
} from '../engine/recovery';
import { createBlock, HYPERTROPHY_BLOCK_DAYS, generateSession, nextDay, swapExerciseInSlot } from '../engine/blocks';
import { achievableLoads } from '../engine/loading';
import { adjustRemainingSets, type InSessionAdjustment } from '../engine/overload';
import { rankCandidates, type SelectionContext } from '../engine/selector';
import { activeGym } from '../engine/types';
import { isSameCalendarDay } from '../engine/time';
import type {
  Block,
  ConditioningLog,
  Exercise,
  PrescribedExercise,
  PrescribedSession,
  SetLog,
  Side,
  Slot,
  UserProfile,
} from '../engine/types';
import * as repo from '../storage/repository';

/* ------------------------------------------------------------------ *
 * Rebuilding fatigue state from the flat log
 * ------------------------------------------------------------------ */

/**
 * There is no cached fatigue state on disk — it is cheap to fold the whole
 * history back into one on every load, and doing it this way means the
 * number displayed can never drift from the sets and conditioning it was
 * computed from. At this app's scale (a few thousand sets a year) this is
 * comfortably sub-millisecond work, not a real cost.
 */
export function rebuildFatigue(
  sets: SetLog[],
  conditioning: ConditioningLog[],
  catalogById: Map<string, Exercise>,
  at: number,
): FatigueState {
  const events: { at: number; apply: (s: FatigueState) => FatigueState }[] = [];

  for (const set of sets) {
    const exercise = catalogById.get(set.exerciseId);
    if (!exercise) continue;
    events.push({ at: set.completedAt, apply: (s) => applySet(s, set, exercise) });
  }
  for (const log of conditioning) {
    events.push({ at: log.startedAt, apply: (s) => applyConditioning(s, log) });
  }
  events.sort((a, b) => a.at - b.at);

  let state = initialFatigueState(events[0]?.at ?? at);
  for (const event of events) state = event.apply(state);
  return state;
}

export function buildSelectionContext(
  profile: UserProfile,
  sets: SetLog[],
  fatigue: FatigueState,
  at: number,
  weeksTrained: number,
): SelectionContext {
  const recentExerciseIds = [...new Set([...sets].sort((a, b) => b.completedAt - a.completedAt).map((s) => s.exerciseId))];

  const historyCounts = new Map<string, number>();
  const seenPerSession = new Set<string>();
  for (const s of sets) {
    const key = `${s.sessionId}:${s.exerciseId}`;
    if (seenPerSession.has(key)) continue;
    seenPerSession.add(key);
    historyCounts.set(s.exerciseId, (historyCounts.get(s.exerciseId) ?? 0) + 1);
  }

  const earnedCeiling = earnedImpactCeiling(fatigue.jointLoad, weeksTrained);
  const ceilingRank = { none: 0, low: 1, moderate: 2, high: 3 } as const;
  const impactCeiling =
    ceilingRank[profile.impactCeiling] < ceilingRank[earnedCeiling] ? profile.impactCeiling : earnedCeiling;

  return {
    recovery: recoveryAt(fatigue, at),
    profile,
    impactCeiling,
    recentExerciseIds,
    historyCounts,
    painFlags: new Set(profile.flaggedJoints),
  };
}

/* ------------------------------------------------------------------ *
 * Today
 * ------------------------------------------------------------------ */

export interface TodayState {
  block: Block;
  /** The prescribed session for today — resumed as-is, or freshly generated. */
  prescription: PrescribedSession;
  /** The id every `logSet`/`skipSet` call for this session must use. */
  sessionId: string;
  /** True when this session already existed on disk before this call. */
  resumed: boolean;
}

/**
 * Get or create the active block. A fresh block is only ever started when
 * none exists — advancing to the next block is a deliberate action, not
 * something that happens quietly during a normal "what's today" load.
 */
export async function ensureActiveBlock(catalog: Exercise[], profile: UserProfile, at: number): Promise<Block> {
  const existing = await repo.getActiveBlock();
  if (existing) return existing;

  const sets = await repo.getAllSets();
  const catalogById = new Map(catalog.map((e) => [e.id, e]));
  const fatigue = rebuildFatigue(sets, await repo.getConditioningLogs(), catalogById, at);
  const ctx = buildSelectionContext(profile, sets, fatigue, at, 0);

  const block = createBlock('block-2', 'Hypertrophy Block', HYPERTROPHY_BLOCK_DAYS, catalog, ctx, at);
  await repo.startNewBlock(block);
  return block;
}

/**
 * Resume today's session if one is already in progress; otherwise generate
 * it fresh from current recovery state and persist it immediately, so a kill
 * one second later resumes the exact same prescription rather than
 * regenerating (and potentially drifting, since recovery keeps decaying).
 *
 * `readiness` (1-5, self-reported) only matters for a session being
 * generated for the first time — it scales `volumeMultiplier` before the
 * prescription is built, so it has to be collected *before* this call, not
 * after. `hasSessionStartedToday` tells the caller whether that ship has
 * already sailed (a resumed session's readiness was fixed when it was first
 * generated) so the UI knows whether to ask.
 */
export async function loadToday(
  catalog: Exercise[],
  profile: UserProfile,
  at: number,
  readiness?: number,
): Promise<TodayState> {
  const block = await ensureActiveBlock(catalog, profile, at);

  const [existingRecord, existingPrescription] = await Promise.all([
    repo.getActiveSessionRecord(),
    repo.getActivePrescription(),
  ]);
  if (existingRecord && existingPrescription && existingRecord.blockId === block.id) {
    return { block, prescription: existingPrescription, sessionId: existingRecord.id, resumed: true };
  }

  const sets = await repo.getAllSets();
  const conditioning = await repo.getConditioningLogs();
  const catalogById = new Map(catalog.map((e) => [e.id, e]));
  const fatigue = rebuildFatigue(sets, conditioning, catalogById, at);

  const weeksTrained = Math.floor((at - block.startedAt) / (7 * 86_400_000));
  const ctx = buildSelectionContext(profile, sets, fatigue, at, weeksTrained);

  const completed = await repo.getCompletedSessionsForBlock(block.id);
  const { weekNumber, dayId } = nextDay(block, completed);

  const load = systemicLoad(
    sets.map((s) => ({ set: s, exercise: catalogById.get(s.exerciseId)! })).filter((x) => x.exercise),
    conditioning,
    at,
  );

  const prescription = generateSession({
    block,
    weekNumber,
    dayId,
    catalog,
    ctx,
    profile,
    history: sets,
    volumeMultiplier: volumeMultiplier(load, readiness),
  });

  const sessionId = `sess-${block.id}-${weekNumber}-${dayId}-${at}`;
  await repo.startSession(
    { id: sessionId, blockId: block.id, weekNumber, dayId, startedAt: at, readiness },
    prescription,
  );

  return { block, prescription, sessionId, resumed: false };
}

/**
 * Whether a session already exists for "today" — tells the UI whether it's
 * too late to ask readiness.
 *
 * Self-healing: without this, a session started and then paused or simply
 * forgotten stays "active" indefinitely, and every future app open sees it
 * and offers "Continue" instead of ever asking readiness or generating a
 * new day — silently stuck on whatever day it was abandoned. A session
 * whose record dates to an earlier calendar day is closed out here instead:
 * whatever sets were logged still count toward progress and fatigue, they
 * just get filed as finished rather than holding every day after it hostage.
 */
export async function hasStartedTodaySession(now: number = Date.now()): Promise<boolean> {
  const [record, prescription] = await Promise.all([repo.getActiveSessionRecord(), repo.getActivePrescription()]);
  if (!record || !prescription) return false;

  if (!isSameCalendarDay(record.startedAt, now)) {
    await repo.completeActiveSession(now);
    return false;
  }

  return true;
}

/* ------------------------------------------------------------------ *
 * Logging a set — the interaction contract from the plan
 * ------------------------------------------------------------------ */

export interface LogSetInput {
  prescription: PrescribedSession;
  slot: Slot;
  exerciseIndex: number;
  setIndex: number;
  side: Side;
  weight: number;
  reps: number;
  rpe: number;
  at: number;
  profile: UserProfile;
}

export interface LogSetResult {
  prescription: PrescribedSession;
  adjustment: InSessionAdjustment;
}

/**
 * One DONE tap, fully handled: the set is durably written first — before any
 * adjustment math runs — then the remaining sets on this exercise are
 * re-tuned per the in-session autoregulation table, and the updated
 * prescription is persisted so a resume shows the adjusted targets, not the
 * stale original ones.
 */
export async function logSet(sessionId: string, input: LogSetInput): Promise<LogSetResult> {
  const { prescription, slot, exerciseIndex, setIndex, side, weight, reps, rpe, at, profile } = input;
  const exercise = prescription.exercises[exerciseIndex];
  if (!exercise) throw new Error(`No exercise at index ${exerciseIndex}`);

  const entry: SetLog = {
    id: `set-${sessionId}-${exercise.slotId}-${setIndex}-${side}-${at}`,
    sessionId,
    exerciseId: exercise.exercise.id,
    setIndex,
    side,
    weight,
    reps,
    rpe,
    completedAt: at,
  };

  // Durability first: this write must land before anything downstream reads
  // "what have I done in this session so far."
  await repo.appendSet(entry);

  const remaining = exercise.sets.filter((s) => s.setIndex > setIndex);
  const priorSets = await repo.getAllSets().then((all) =>
    all
      .filter((s) => s.sessionId === sessionId && s.exerciseId === exercise.exercise.id)
      .sort((a, b) => b.completedAt - a.completedAt),
  );
  const consecutiveMisses = countConsecutiveMisses(priorSets, slot);

  const achievable = achievableLoads(exercise.exercise, activeGym(profile));
  const adjustment = adjustRemainingSets(entry, remaining, slot, achievable, consecutiveMisses);

  const updatedSets = [
    ...exercise.sets.filter((s) => s.setIndex <= setIndex),
    ...adjustment.remaining,
  ];
  const updatedExercise: PrescribedExercise = { ...exercise, sets: updatedSets };
  const updatedExercises = prescription.exercises.map((e, i) => (i === exerciseIndex ? updatedExercise : e));
  const updatedPrescription: PrescribedSession = { ...prescription, exercises: updatedExercises };

  await repo.saveActivePrescription(updatedPrescription);

  return { prescription: updatedPrescription, adjustment };
}

function countConsecutiveMisses(recentSetsNewestFirst: SetLog[], slot: Slot): number {
  let count = 0;
  for (const set of recentSetsNewestFirst) {
    if (set.skipped) continue;
    if (set.reps < slot.repMin - 2 || set.rpe >= 9.5) count += 1;
    else break;
  }
  return count;
}

/* ------------------------------------------------------------------ *
 * Swapping an exercise mid-session
 * ------------------------------------------------------------------ */

export interface SwapCandidate {
  exercise: Exercise;
  score: number;
}

/**
 * Rank alternatives for a slot the same way the generator itself fills that
 * slot, so "Swap" offers exactly what selection would have chosen — not a
 * separate ad hoc list. Returns an empty list for a locked slot rather than
 * throwing: the caller (UI) hides the swap affordance on locked slots
 * anyway, and an empty picker is easier for it to handle than an error.
 */
export async function swapCandidates(
  catalog: Exercise[],
  profile: UserProfile,
  slotId: string,
  at: number,
): Promise<SwapCandidate[]> {
  const [block, prescription, sets, conditioning] = await Promise.all([
    repo.getActiveBlock(),
    repo.getActivePrescription(),
    repo.getAllSets(),
    repo.getConditioningLogs(),
  ]);
  if (!block || !prescription) return [];

  const day = block.days.find((d) => d.id === prescription.dayId);
  const slotDef = day?.slots.find((s) => s.id === slotId);
  if (!slotDef || slotDef.locked) return [];

  const catalogById = new Map(catalog.map((e) => [e.id, e]));
  const fatigue = rebuildFatigue(sets, conditioning, catalogById, at);
  const weeksTrained = Math.floor((at - block.startedAt) / (7 * 86_400_000));
  const ctx = buildSelectionContext(profile, sets, fatigue, at, weeksTrained);

  const currentExerciseId = prescription.exercises.find((e) => e.slotId === slotId)?.exercise.id;

  return rankCandidates(catalog, slotDef, ctx).filter((c) => c.exercise.id !== currentExerciseId);
}

export interface SwapExerciseInput {
  sessionId: string;
  slotId: string;
  newExerciseId: string;
  catalog: Exercise[];
  profile: UserProfile;
  at: number;
}

/**
 * Replace one non-locked exercise in today's prescription with another,
 * rebuilding its sets from scratch against the target slot's rules (not the
 * exercise's own history in some other slot). Reuses the exact same fatigue
 * and volume-multiplier inputs `loadToday` would compute right now, so a
 * swapped exercise is sized as if it had been selected fresh — not just
 * dropped in with yesterday's numbers.
 */
export async function swapExercise(input: SwapExerciseInput): Promise<PrescribedSession> {
  const { sessionId, slotId, newExerciseId, catalog, profile, at } = input;

  const [block, record, prescription, sets, conditioning] = await Promise.all([
    repo.getActiveBlock(),
    repo.getActiveSessionRecord(),
    repo.getActivePrescription(),
    repo.getAllSets(),
    repo.getConditioningLogs(),
  ]);
  if (!block) throw new Error('No active block');
  if (!record || record.id !== sessionId) throw new Error(`Session "${sessionId}" is not the active session`);
  if (!prescription) throw new Error('No active prescription');

  const exercise = catalog.find((e) => e.id === newExerciseId);
  if (!exercise) throw new Error(`Unknown exercise "${newExerciseId}"`);

  const catalogById = new Map(catalog.map((e) => [e.id, e]));
  const fatigue = rebuildFatigue(sets, conditioning, catalogById, at);
  const recovery = recoveryAt(fatigue, at);

  const load = systemicLoad(
    sets.map((s) => ({ set: s, exercise: catalogById.get(s.exerciseId)! })).filter((x) => x.exercise),
    conditioning,
    at,
  );

  const swapped = swapExerciseInSlot(
    block,
    prescription.dayId,
    slotId,
    exercise,
    activeGym(profile),
    profile,
    sets,
    recovery,
    prescription.weekNumber,
    volumeMultiplier(load, record.readiness),
  );

  const updatedExercises = prescription.exercises.map((e) => (e.slotId === slotId ? swapped : e));
  const updatedPrescription: PrescribedSession = { ...prescription, exercises: updatedExercises };

  await repo.saveActivePrescription(updatedPrescription);

  return updatedPrescription;
}

/** Skip a set (or a whole exercise) with an optional reason — a first-class, not-nagged-about action. */
export async function skipSet(
  sessionId: string,
  exercise: PrescribedExercise,
  setIndex: number,
  side: Side,
  reason: SetLog['skipReason'],
  at: number,
): Promise<void> {
  const entry: SetLog = {
    id: `skip-${sessionId}-${exercise.slotId}-${setIndex}-${side}-${at}`,
    sessionId,
    exerciseId: exercise.exercise.id,
    setIndex,
    side,
    weight: 0,
    reps: 0,
    rpe: 0,
    completedAt: at,
    skipped: true,
    skipReason: reason,
  };
  await repo.appendSet(entry);
}

/** Finish the session. */
export function completeSession(at: number) {
  return repo.completeActiveSession(at);
}

export function discardUntouchedSession() {
  return repo.discardActiveSessionIfUntouched();
}

/* ------------------------------------------------------------------ *
 * Resume position — where in the prescription a session picks back up
 * ------------------------------------------------------------------ */

/**
 * Given the sets already logged this session, find the first exercise that
 * isn't fully logged and the position within it. This is how the player
 * decides "which set am I on" after a resume — purely from what's on disk,
 * not from any in-memory pointer that a killed app would have lost.
 *
 * An `exerciseIndex` equal to `prescription.exercises.length` means every
 * exercise is already fully logged — the session is done in substance even
 * if `completeSession` hasn't been called yet.
 */
export function resumePosition(
  prescription: PrescribedSession,
  sessionSets: SetLog[],
): { exerciseIndex: number; setPos: number } {
  for (let i = 0; i < prescription.exercises.length; i += 1) {
    const exercise = prescription.exercises[i]!;
    const loggedCount = sessionSets.filter((s) => s.exerciseId === exercise.exercise.id).length;
    if (loggedCount < exercise.sets.length) {
      return { exerciseIndex: i, setPos: loggedCount };
    }
  }
  return { exerciseIndex: prescription.exercises.length, setPos: 0 };
}
