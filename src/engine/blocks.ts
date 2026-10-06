/**
 * Block templates and session generation.
 *
 * A block is a six-week arc with a deload at the end. That arc is doing real
 * psychological work: "week 3 of 6" gives a session a place in a story and an
 * end you can see, which is exactly what a purely generative day-by-day app
 * can never offer.
 */

import { ladderChain } from './baseline';
import { achievableLoads, resolveLoad } from './loading';
import { applyDeload, bestE1RM, isDeloadWeek, nextPrescription } from './overload';
import { primaryRecovery } from './recovery';
import { attemptsFor, buildLadderIndex, evaluateLadder, nextRung, type LadderIndex } from './ladders';
import { asymmetryFor, sideOrder } from './asymmetry';
import { selectForSlot, unilateralPreference, rankCandidates, type SelectionContext } from './selector';
import { activeGym } from './types';
import type {
  Block,
  DayTemplate,
  Exercise,
  Gym,
  MuscleMap,
  PrescribedExercise,
  PrescribedSession,
  PrescribedSet,
  SetLog,
  Slot,
  UserProfile,
} from './types';

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

function slot(
  id: string,
  role: Slot['role'],
  pattern: Slot['pattern'],
  sets: number,
  repMin: number,
  repMax: number,
  targetRpe: number,
  restSec: number,
  opts: { preferCorrective?: boolean } = {},
): Slot {
  return {
    id,
    role,
    pattern,
    sets,
    repMin,
    repMax,
    targetRpe,
    restSec,
    locked: role === 'primary',
    preferCorrective: opts.preferCorrective ?? false,
  };
}

/**
 * A four-day hybrid rotation — two strength days, a build day, an athletic
 * day — where every day is full-body-leaning.
 *
 * Why not a five-day split: real weeks have three sessions in them as often
 * as five (work, holidays, Insanity on top), and a body-part split punishes a
 * missed day by dropping a muscle for a week. Here each muscle is hit on at
 * least two of any three consecutive days, and `nextDay()` rotates by
 * sessions completed rather than by calendar, so a three-session week just
 * carries the rotation into the next one with nothing skipped.
 *
 * Strength days run heavy locked primaries (4–8 reps) — load is what builds
 * dense-looking muscle, and it's what the locks make measurable. Build day is
 * moderate-rep volume and calisthenics; Athletic day puts explosive work
 * first while the nervous system is fresh. Volume sits at the low-to-mid end
 * of the 10–20 set landmarks on purpose: hard conditioning (Insanity,
 * running) shares the same recovery budget.
 *
 * Corrective work still rides along rather than getting its own day —
 * upper-back volume against rolled shoulders, unilateral bias on lunges,
 * anti-rotation core for the hip.
 */
export const HYBRID_BLOCK_DAYS: DayTemplate[] = [
  {
    id: 'strength-a',
    name: 'Strength A',
    slots: [
      slot('a-primary-squat', 'primary', 'squat', 4, 4, 8, 8, 150),
      slot('a-primary-push', 'primary', 'horizontalPush', 4, 5, 8, 8, 120),
      slot('a-sec-row', 'secondary', 'horizontalPull', 3, 8, 12, 7.5, 90, { preferCorrective: true }),
      slot('a-sec-hinge', 'secondary', 'hinge', 3, 8, 12, 7.5, 90),
      slot('a-acc-delts', 'accessory', 'shoulderAbduction', 3, 12, 20, 7, 60),
      slot('a-fin-core', 'finisher', 'antiRotation', 2, 8, 12, 7, 60, { preferCorrective: true }),
    ],
  },
  {
    id: 'strength-b',
    name: 'Strength B',
    slots: [
      slot('b-primary-hinge', 'primary', 'hinge', 4, 4, 8, 8, 150),
      slot('b-primary-pull', 'primary', 'verticalPull', 4, 5, 8, 8, 120),
      slot('b-sec-press', 'secondary', 'verticalPush', 3, 8, 12, 7.5, 90),
      slot('b-sec-lunge', 'secondary', 'lunge', 3, 8, 12, 7.5, 90, { preferCorrective: true }),
      slot('b-acc-arms', 'accessory', 'elbowFlexion', 3, 10, 15, 7, 60),
      slot('b-fin-carry', 'finisher', 'carry', 2, 30, 45, 7, 60),
    ],
  },
  {
    id: 'build',
    name: 'Build',
    slots: [
      slot('c-sec-push', 'secondary', 'horizontalPush', 3, 8, 15, 7.5, 75),
      slot('c-sec-pull', 'secondary', 'horizontalPull', 3, 10, 15, 7.5, 75),
      slot('c-sec-legs', 'secondary', 'squat', 3, 10, 15, 7.5, 75),
      slot('c-acc-triceps', 'accessory', 'elbowExtension', 4, 10, 15, 7, 45),
      slot('c-acc-biceps', 'accessory', 'elbowFlexion', 2, 10, 15, 7, 45),
      slot('c-acc-delts', 'accessory', 'shoulderAbduction', 3, 12, 20, 7, 45),
      // Direct hamstring work: hinges load hamstrings at long length, curls
      // train knee flexion, and both are needed for full development.
      slot('c-acc-hams', 'accessory', 'kneeFlexion', 3, 10, 15, 7, 45),
      slot('c-acc-calves', 'accessory', 'calfRaise', 4, 12, 20, 7, 45),
      slot('c-fin-neck', 'finisher', 'neck', 2, 10, 15, 6.5, 60, { preferCorrective: true }),
    ],
  },
  {
    id: 'athletic',
    name: 'Athletic',
    slots: [
      // Explosive work first, fresh, low reps, full rest — power is a
      // quality, and fatigue turns it into sloppy conditioning.
      slot('d-power', 'secondary', 'power', 3, 3, 5, 6.5, 90),
      slot('d-sec-hinge', 'secondary', 'hinge', 3, 10, 15, 7, 60),
      slot('d-sec-lunge', 'secondary', 'lunge', 3, 8, 12, 7, 60, { preferCorrective: true }),
      slot('d-sec-push', 'secondary', 'horizontalPush', 3, 10, 15, 7, 60),
      slot('d-acc-rotation', 'accessory', 'rotation', 3, 6, 10, 7, 60, { preferCorrective: true }),
      slot('d-acc-calves', 'accessory', 'calfRaise', 5, 12, 20, 7, 45),
      slot('d-fin-carry', 'finisher', 'carry', 2, 40, 60, 7.5, 60),
    ],
  },
];

export const BLOCK_WEEKS = 6;

/**
 * Below this recovery fraction, the recovery guard cuts a locked primary's
 * dose rather than letting the schedule alone protect a fatigued muscle.
 * Matches the steep-penalty knee in `selector.ts`'s `recoveryFit`, so the
 * guard kicks in exactly where the scorer already treats recovery as
 * critical rather than merely suboptimal.
 */
export const RECOVERY_GUARD_THRESHOLD = 0.4;

/* ------------------------------------------------------------------ *
 * Block creation
 * ------------------------------------------------------------------ */

/**
 * Choose one gym's locked primary lifts.
 *
 * Unilateral variants win ties here on purpose — with a known right-side
 * preference, a locked bilateral primary would let the strong side carry the
 * whole block without ever showing up in the numbers.
 */
/**
 * How far a lift can be progressed by load in this gym, 0..1. A locked
 * primary has to carry six weeks of progression, so a goblet squat capped at
 * a 30 lb dumbbell is a poor lock for a 285 lb lifter when a rack and 700 lb
 * of plates are available. Ladder movements score zero: a locked primary
 * never changes rung mid-block, so its only progression would be reps.
 */
function loadHeadroom(exercise: Exercise, gym: Gym, bodyweight: number): number {
  if (exercise.loadType !== 'external') return 0;
  const loads = achievableLoads(exercise, gym);
  if (loads.length === 0) return 0;
  return Math.min(1, loads.at(-1)! / Math.max(1, bodyweight));
}

/** Weight of the headroom term when choosing a locked primary. */
const PRIMARY_HEADROOM_WEIGHT = 0.15;

function chooseLocks(days: DayTemplate[], catalog: Exercise[], ctx: SelectionContext): Record<string, string> {
  const locks: Record<string, string> = {};
  const used = new Set<string>();
  const gym = activeGym(ctx.profile);
  const lockScore = (e: Exercise, score: number) =>
    score + PRIMARY_HEADROOM_WEIGHT * loadHeadroom(e, gym, ctx.profile.bodyweight);

  for (const day of days) {
    for (const s of day.slots) {
      if (!s.locked) continue;
      const ranked = rankCandidates(catalog, s, ctx)
        .filter((r) => !used.has(r.exercise.id) && !r.exercise.isolation)
        .sort(
          (a, b) =>
            lockScore(b.exercise, b.score) - lockScore(a.exercise, a.score) ||
            unilateralPreference(a.exercise, b.exercise) ||
            a.exercise.id.localeCompare(b.exercise.id),
        );
      const chosen = ranked[0]?.exercise;
      if (chosen) {
        locks[s.id] = chosen.id;
        used.add(chosen.id);
      }
    }
  }
  return locks;
}

/** Create a block, locking primaries for the gym `ctx.profile` is training in. */
export function createBlock(
  id: string,
  name: string,
  days: DayTemplate[],
  catalog: Exercise[],
  ctx: SelectionContext,
  startedAt: number,
): Block {
  return {
    id,
    name,
    weeks: BLOCK_WEEKS,
    deloadWeek: BLOCK_WEEKS,
    days,
    startedAt,
    lockedAssignments: { [activeGym(ctx.profile).id]: chooseLocks(days, catalog, ctx) },
  };
}

/**
 * The block with primaries locked for the active gym, adding them the first
 * time a session is built there. Returns the same object when nothing changed,
 * so callers can tell whether it needs persisting.
 */
export function withGymLocks(block: Block, catalog: Exercise[], ctx: SelectionContext): Block {
  const gymId = activeGym(ctx.profile).id;
  if (block.lockedAssignments[gymId]) return block;
  return {
    ...block,
    lockedAssignments: { ...block.lockedAssignments, [gymId]: chooseLocks(block.days, catalog, ctx) },
  };
}

/* ------------------------------------------------------------------ *
 * Session generation
 * ------------------------------------------------------------------ */

export interface GenerationInput {
  block: Block;
  weekNumber: number;
  dayId: string;
  catalog: Exercise[];
  ctx: SelectionContext;
  profile: UserProfile;
  /** All historical sets, used for progression, ladders, and ghost values. */
  history: SetLog[];
  /** Scales total volume, from readiness and systemic load. */
  volumeMultiplier: number;
  /**
   * True when a plyometric conditioning session (Insanity) already happened in
   * the last 48 hours. That session already covered the jumping volume, so
   * power slots drop to a single skill set instead of adding more contacts on
   * top of hundreds.
   */
  powerCovered?: boolean;
}

const SECONDS_PER_REP = 3.5;

function buildSets(
  slotDef: Slot,
  weight: number,
  repTarget: number,
  sides: PrescribedSet['side'][],
  volumeMultiplier: number,
): PrescribedSet[] {
  const setCount = Math.max(1, Math.round(slotDef.sets * volumeMultiplier));
  const out: PrescribedSet[] = [];

  let index = 0;
  for (let i = 0; i < setCount; i += 1) {
    for (const side of sides) {
      out.push({
        setIndex: index,
        weight,
        repTarget,
        targetRpe: slotDef.targetRpe,
        side,
      });
      index += 1;
    }
  }
  return out;
}

/**
 * Turn a fixed exercise into its full prescription for a slot — load, reps,
 * sides, deload scaling, the recovery guard, ghost values. Shared by fresh
 * session generation (after the selector and ladder decide *which* exercise)
 * and by a manual swap (which already knows which exercise and skips both).
 */
function prescribeExercise(
  slotDef: Slot,
  exercise: Exercise,
  gym: Gym,
  profile: UserProfile,
  history: SetLog[],
  recovery: MuscleMap,
  deload: boolean,
  volumeMultiplier: number,
): PrescribedExercise {
  const loadable = exercise.loadType === 'external';
  const lastAttempt = attemptsFor(history, exercise.id)[0]?.sets ?? [];
  // The single gate that keeps prescriptions physically loadable: every
  // weight downstream of here is snapped to something this gym actually has.
  const achievable = achievableLoads(exercise, gym);
  const progression = nextPrescription({ slot: slotDef, lastAttempt, profile, loadable, achievable });

  const reading = exercise.unilateral ? asymmetryFor(history, exercise.id) : undefined;
  const sides: PrescribedSet['side'][] = exercise.unilateral ? sideOrder(reading) : ['both'];

  let sets = buildSets(
    slotDef,
    resolveLoad(progression.weight, achievable),
    progression.repTarget,
    sides,
    deload ? 1 : volumeMultiplier,
  );
  if (deload) sets = applyDeload(sets, achievable);

  // Recovery guard.
  //
  // Locking primaries is what makes progress measurable, and it is also what
  // takes away the selector's ability to route around a fatigued muscle. So
  // the schedule is normally the only thing protecting you — and schedules
  // break the moment someone trains four days in a row, or comes back from a
  // long run and trains anyway. Rather than abandon the lock (which would
  // cost the whole point of the block) we keep the movement and cut the
  // dose: fewer sets, capped RPE.
  const underRecovered = primaryRecovery(recovery, exercise) < RECOVERY_GUARD_THRESHOLD;
  if (underRecovered && !deload) {
    sets = sets.slice(0, Math.max(1, Math.floor(sets.length * 0.5))).map((s) => ({
      ...s,
      targetRpe: Math.min(s.targetRpe, 7),
    }));
  }

  const last = lastAttempt[lastAttempt.length - 1];
  const priorBest = bestE1RM(history.filter((s) => s.exerciseId === exercise.id));

  return {
    slotId: slotDef.id,
    role: slotDef.role,
    exercise,
    sets,
    restSec: slotDef.restSec,
    lastPerformance: last
      ? { weight: last.weight, reps: last.reps, rpe: last.rpe, at: last.completedAt }
      : undefined,
    bestE1RM: priorBest > 0 ? priorBest : undefined,
    reducedForRecovery: underRecovered && !deload,
  };
}

/**
 * Rebuild one slot's prescription around a manually chosen exercise,
 * bypassing the selector and ladder entirely — this is what a manual swap
 * calls, not what a fresh session generation calls.
 *
 * Refuses for a locked primary slot: swapping it would break the
 * whole-block measurability the lock exists to guarantee. Only
 * secondary/accessory/finisher slots are open to a manual swap, same as
 * they already are to the selector's own rotation.
 */
export function swapExerciseInSlot(
  block: Block,
  dayId: string,
  slotId: string,
  exercise: Exercise,
  gym: Gym,
  profile: UserProfile,
  history: SetLog[],
  recovery: MuscleMap,
  weekNumber: number,
  volumeMultiplier: number,
): PrescribedExercise {
  const day = block.days.find((d) => d.id === dayId);
  if (!day) throw new Error(`Unknown day "${dayId}" in block "${block.id}"`);
  const slotDef = day.slots.find((s) => s.id === slotId);
  if (!slotDef) throw new Error(`Unknown slot "${slotId}" on day "${dayId}"`);
  if (slotDef.locked) throw new Error(`Cannot swap the locked primary slot "${slotId}"`);

  const deload = isDeloadWeek(weekNumber, block.deloadWeek);
  return prescribeExercise(slotDef, exercise, gym, profile, history, recovery, deload, volumeMultiplier);
}

/**
 * Build the session the player will render.
 *
 * Order of operations matters: ladder verdict first (which exercise), then
 * progression (what numbers), then deload (whether to scale it all back).
 */
export function generateSession(input: GenerationInput): PrescribedSession {
  const { block, weekNumber, dayId, catalog, ctx, profile, history, volumeMultiplier } = input;

  const day = block.days.find((d) => d.id === dayId);
  if (!day) throw new Error(`Unknown day "${dayId}" in block "${block.id}"`);

  const catalogById = new Map(catalog.map((e) => [e.id, e]));
  const ladderIndex: LadderIndex = buildLadderIndex(catalog);
  const gym = activeGym(profile);
  const availableEquipment = new Set<string>(gym.equipment);
  const deload = isDeloadWeek(weekNumber, block.deloadWeek);

  const chosenThisSession = new Set<string>();
  const exercises: PrescribedExercise[] = [];

  // On a genuinely depleted day, shorten the session rather than shaving
  // fractions off every set. Scaling set counts alone gets eaten by rounding,
  // so a hard run the day before would leave today's session visibly
  // unchanged — and an app that ignores what you just did stops being
  // believable. Dropping the trailing accessory is legible and honest.
  const trimAccessories = !deload && volumeMultiplier < 0.9;
  const slots = (
    trimAccessories
      ? day.slots.filter((s, i) => s.role !== 'accessory' || i === day.slots.findIndex((x) => x.role === 'accessory'))
      : day.slots
  ).map((s) => (input.powerCovered && s.pattern === 'power' ? { ...s, sets: 1 } : s));

  /**
   * The baseline rung sitting on the same ladder as `exercise`, if the test
   * placed one there. Matching by chain rather than by id is what lets a
   * push-up test govern the whole push-up ladder no matter which rung the
   * selector happened to pick.
   */
  function baselineRungFor(
    exercise: Exercise,
    p: UserProfile,
    index: LadderIndex,
    byId: Map<string, Exercise>,
  ): Exercise | undefined {
    if (!p.baselineRungs?.length) return undefined;
    const chain = ladderChain(exercise, index, byId);
    const chainIds = new Set(chain.map((e) => e.id));
    const match = p.baselineRungs.find((id) => chainIds.has(id));
    return match ? byId.get(match) : undefined;
  }

  const gymLocks = block.lockedAssignments[gym.id] ?? {};
  // A locked primary belongs to its own slot. Letting the scorer also pick it
  // for other days' open slots would put the same lift in the week three
  // times — so locked lifts are kept out of the open slots unless nothing
  // else can fill them.
  const lockedIds = new Set(Object.values(gymLocks));

  for (const slotDef of slots) {
    const lockedId = gymLocks[slotDef.id];
    let exercise = slotDef.locked
      ? selectForSlot(catalog, slotDef, ctx, lockedId, chosenThisSession)
      : (selectForSlot(catalog, slotDef, ctx, undefined, new Set([...chosenThisSession, ...lockedIds])) ??
        selectForSlot(catalog, slotDef, ctx, undefined, chosenThisSession));
    if (!exercise) continue;

    // A locked primary's whole point is that its *identity* holds for the
    // entire block — only its reps and load are allowed to move. Ladder
    // rung changes are exactly the kind of identity change that's reserved
    // for slots the selector is still free to rotate.
    const isLockedPrimary = slotDef.locked && exercise.id === lockedId;

    // Ladder: bodyweight and band work progresses by variant, not by load.
    const attempts = attemptsFor(history, exercise.id);
    if (exercise.loadType !== 'external') {
      // Before any history exists, honour what the baseline test measured.
      // Climbing from the bottom rung when the test already proved a higher
      // one would waste weeks re-earning a known starting point. This still
      // applies to a locked primary — it sets where the lock starts, not
      // where it moves to mid-block.
      const baselineRung = baselineRungFor(exercise, profile, ladderIndex, catalogById);
      if (attempts.length === 0 && baselineRung) {
        exercise = baselineRung;
      } else if (!isLockedPrimary) {
        const verdict = evaluateLadder(attempts, slotDef);
        exercise = nextRung(exercise, verdict, ladderIndex, catalogById, availableEquipment);
      }
    }

    chosenThisSession.add(exercise.id);
    exercises.push(
      prescribeExercise(slotDef, exercise, gym, profile, history, ctx.recovery, deload, volumeMultiplier),
    );
  }

  return {
    blockId: block.id,
    weekNumber,
    dayId,
    dayName: day.name,
    isDeload: deload,
    exercises,
    estimatedMinutes: estimateMinutes(exercises),
  };
}

/**
 * Working time plus rest, rounded to something a human would say out loud.
 * A unilateral set is both sides back to back with one rest after the pair,
 * so rest is counted per round, not per side.
 */
export function estimateMinutes(exercises: PrescribedExercise[]): number {
  let seconds = 0;
  for (const ex of exercises) {
    const sides = new Set(ex.sets.map((s) => s.side)).size || 1;
    for (const set of ex.sets) {
      seconds += set.repTarget * SECONDS_PER_REP + ex.restSec / sides;
    }
  }
  // Arrive and Downshift are fixed overhead on every session.
  seconds += 7 * 60;
  return Math.round(seconds / 60);
}

/**
 * Which day comes next. Strictly rotates through the split rather than picking
 * by recovery — half the value of a block is that tomorrow is knowable.
 */
export function nextDay(block: Block, completedSessions: { dayId: string }[]): {
  weekNumber: number;
  dayId: string;
} {
  const perWeek = block.days.length;
  const done = completedSessions.length;
  const weekNumber = Math.min(block.weeks, Math.floor(done / perWeek) + 1);
  const dayIndex = done % perWeek;
  return { weekNumber, dayId: block.days[dayIndex]!.id };
}
