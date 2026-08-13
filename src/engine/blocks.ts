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
import { applyDeload, isDeloadWeek, nextPrescription } from './overload';
import { primaryRecovery } from './recovery';
import { attemptsFor, buildLadderIndex, evaluateLadder, nextRung, type LadderIndex } from './ladders';
import { asymmetryFor, sideOrder } from './asymmetry';
import { selectForSlot, unilateralPreference, rankCandidates, type SelectionContext } from './selector';
import { activeGym } from './types';
import type {
  Block,
  DayTemplate,
  Exercise,
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
 * Push / Pull / Legs / Upper / Lower across five days.
 *
 * Every muscle still lands two exposures a week — the strongest single
 * predictor of hypertrophy — but PPL now carries the volume (wide rep ranges,
 * isolation work as first-class slots instead of an afterthought) while the
 * Upper/Lower half adds a second heavier compound exposure. Five days rather
 * than six leaves real recovery headroom at 41 and 290 lbs, where joint load
 * and systemic fatigue are constraints conditioning work adds to, not just
 * lifting.
 *
 * Corrective work doesn't get a separate day — it never did. It rides along
 * on the slots that already double as the counterweight: upper-back volume
 * on push work, unilateral bias on lunges, anti-rotation and anti-extension
 * accessories. That's a demotion from headline to ingredient, not a removal.
 */
export const HYPERTROPHY_BLOCK_DAYS: DayTemplate[] = [
  {
    id: 'push',
    name: 'Push',
    slots: [
      slot('push-primary', 'primary', 'horizontalPush', 6, 6, 10, 8, 150),
      slot('push-sec-1', 'secondary', 'verticalPush', 3, 8, 12, 7.5, 120),
      // Upper-back volume on a push day is not a mistake. It is the direct
      // counterweight to rolled-forward shoulders, and it happens to be the
      // same tissue that builds the wrestler silhouette.
      slot('push-sec-2', 'secondary', 'horizontalPull', 3, 10, 15, 7, 120, { preferCorrective: true }),
      slot('push-acc-1', 'accessory', 'shoulderAbduction', 3, 12, 20, 7, 60),
      slot('push-acc-2', 'accessory', 'elbowExtension', 3, 10, 15, 7, 60),
      slot('push-fin', 'finisher', 'coreFlexion', 2, 12, 20, 6.5, 60),
    ],
  },
  {
    id: 'pull',
    name: 'Pull',
    slots: [
      slot('pull-primary', 'primary', 'verticalPull', 4, 6, 10, 8, 150),
      slot('pull-sec-1', 'secondary', 'horizontalPull', 3, 8, 12, 7.5, 120),
      slot('pull-sec-2', 'secondary', 'elbowFlexion', 3, 10, 15, 7, 75),
      slot('pull-acc-1', 'accessory', 'antiRotation', 2, 8, 12, 7, 75, { preferCorrective: true }),
      slot('pull-acc-2', 'accessory', 'rotation', 2, 10, 15, 7, 60, { preferCorrective: true }),
      slot('pull-fin', 'finisher', 'neck', 2, 10, 15, 6.5, 60, { preferCorrective: true }),
    ],
  },
  {
    id: 'legs',
    name: 'Legs',
    slots: [
      slot('legs-primary', 'primary', 'squat', 4, 6, 10, 8, 150),
      slot('legs-sec-1', 'secondary', 'hinge', 3, 8, 12, 7.5, 120),
      slot('legs-sec-2', 'secondary', 'lunge', 3, 8, 12, 7.5, 120, { preferCorrective: true }),
      slot('legs-acc-1', 'accessory', 'bridge', 2, 10, 15, 7, 75, { preferCorrective: true }),
      slot('legs-acc-2', 'accessory', 'calfRaise', 5, 12, 20, 7, 60),
      slot('legs-fin', 'finisher', 'carry', 2, 30, 45, 7, 60),
    ],
  },
  {
    id: 'upper',
    name: 'Upper',
    slots: [
      // Two heavy compounds, not one — this day's whole job is a second
      // weekly exposure for chest and back at real intensity, on top of what
      // Push and Pull already deliver. `createBlock` locks each primary from
      // the ranked candidate list in slot order, so this naturally lands a
      // different chest/back exercise than Push/Pull chose rather than
      // repeating them.
      slot('upper-primary-push', 'primary', 'horizontalPush', 6, 6, 10, 8, 150),
      slot('upper-primary-pull', 'primary', 'horizontalPull', 3, 6, 10, 8, 150),
      slot('upper-sec-1', 'secondary', 'elbowFlexion', 3, 8, 12, 7.5, 75),
      slot('upper-sec-2', 'secondary', 'elbowExtension', 3, 8, 12, 7.5, 75),
      slot('upper-acc-1', 'accessory', 'shoulderAbduction', 3, 12, 20, 7, 60),
      slot('upper-fin', 'finisher', 'antiExtension', 2, 8, 12, 6.5, 60, { preferCorrective: true }),
    ],
  },
  {
    id: 'lower',
    name: 'Lower',
    slots: [
      slot('lower-primary', 'primary', 'hinge', 4, 6, 10, 8, 150),
      slot('lower-sec-1', 'secondary', 'squat', 3, 10, 15, 7, 120),
      slot('lower-sec-2', 'secondary', 'lunge', 3, 8, 12, 7.5, 120, { preferCorrective: true }),
      slot('lower-acc-1', 'accessory', 'bridge', 2, 10, 15, 7, 75, { preferCorrective: true }),
      // Abs already land well past the volume floor from bracing work on
      // every compound day (squats, hinges, presses, carries all credit abs
      // as a secondary mover) — calves get nothing outside a dedicated slot,
      // so this is their second weekly exposure, not a repeat of Legs day.
      slot('lower-acc-2', 'accessory', 'calfRaise', 5, 12, 20, 7, 60),
      slot('lower-fin', 'finisher', 'carry', 2, 30, 45, 7, 60),
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
 * Choose the block's locked primary lifts once, at creation.
 *
 * Unilateral variants win ties here on purpose — with a known right-side
 * preference, a locked bilateral primary would let the strong side carry the
 * whole block without ever showing up in the numbers.
 */
export function createBlock(
  id: string,
  name: string,
  days: DayTemplate[],
  catalog: Exercise[],
  ctx: SelectionContext,
  startedAt: number,
): Block {
  const lockedAssignments: Record<string, string> = {};
  const used = new Set<string>();

  for (const day of days) {
    for (const s of day.slots) {
      if (!s.locked) continue;
      const ranked = rankCandidates(catalog, s, ctx)
        .filter((r) => !used.has(r.exercise.id))
        .sort(
          (a, b) =>
            b.score - a.score ||
            unilateralPreference(a.exercise, b.exercise) ||
            a.exercise.id.localeCompare(b.exercise.id),
        );
      const chosen = ranked[0]?.exercise;
      if (chosen) {
        lockedAssignments[s.id] = chosen.id;
        used.add(chosen.id);
      }
    }
  }

  return {
    id,
    name,
    weeks: BLOCK_WEEKS,
    deloadWeek: BLOCK_WEEKS,
    days,
    startedAt,
    lockedAssignments,
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
  const slots = trimAccessories
    ? day.slots.filter((s, i) => s.role !== 'accessory' || i === day.slots.findIndex((x) => x.role === 'accessory'))
    : day.slots;

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

  for (const slotDef of slots) {
    const lockedId = block.lockedAssignments[slotDef.id];
    let exercise = selectForSlot(catalog, slotDef, ctx, lockedId, chosenThisSession);
    if (!exercise) continue;

    // A locked primary's whole point is that its *identity* holds for the
    // entire block — only its reps and load are allowed to move. Ladder
    // rung changes are exactly the kind of identity change that's reserved
    // for slots the selector is still free to rotate.
    const isLockedPrimary = slotDef.locked && Boolean(lockedId);

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
    const underRecovered = primaryRecovery(ctx.recovery, exercise) < RECOVERY_GUARD_THRESHOLD;
    if (underRecovered && !deload) {
      sets = sets.slice(0, Math.max(1, Math.floor(sets.length * 0.5))).map((s) => ({
        ...s,
        targetRpe: Math.min(s.targetRpe, 7),
      }));
    }

    const last = lastAttempt[lastAttempt.length - 1];

    exercises.push({
      slotId: slotDef.id,
      role: slotDef.role,
      exercise,
      sets,
      restSec: slotDef.restSec,
      lastPerformance: last
        ? { weight: last.weight, reps: last.reps, rpe: last.rpe, at: last.completedAt }
        : undefined,
      reducedForRecovery: underRecovered && !deload,
    });
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

/** Working time plus rest, rounded to something a human would say out loud. */
export function estimateMinutes(exercises: PrescribedExercise[]): number {
  let seconds = 0;
  for (const ex of exercises) {
    for (const set of ex.sets) {
      seconds += set.repTarget * SECONDS_PER_REP + ex.restSec;
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
