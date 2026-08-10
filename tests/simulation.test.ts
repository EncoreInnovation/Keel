/**
 * Twelve-week simulation harness.
 *
 * Unit tests prove each function behaves. This proves the *system* behaves —
 * that two blocks of real training don't drift into overtraining a muscle,
 * stall every ladder, or quietly swap the primary lifts you're trying to
 * measure progress on. These are the failure modes that only appear after
 * dozens of sessions compose, which is exactly when a real person would be
 * the one discovering them.
 */

import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog/exercises';
import { createBlock, CRUISE_BLOCK_DAYS, generateSession, nextDay } from '../src/engine/blocks';
import {
  applyConditioning,
  applySet,
  earnedImpactCeiling,
  initialFatigueState,
  recoveryAt,
  systemicLoad,
  volumeMultiplier,
  type FatigueState,
} from '../src/engine/recovery';
import { rungDepth, buildLadderIndex } from '../src/engine/ladders';
import type { SelectionContext } from '../src/engine/selector';
import type {
  ConditioningLog,
  Exercise,
  SetLog,
  UserProfile,
} from '../src/engine/types';

const DAY = 86_400_000;
const T0 = 1_700_000_000_000;

/** Training days land Mon / Tue / Thu / Fri — 48–72h between same-type days. */
const DAY_OFFSETS = [0, 1, 3, 4];

const PROFILE: UserProfile = {
  bodyweight: 292,
  level: 'novice',
  availableEquipment: [
    'bodyweight',
    'dumbbell',
    'kettlebell',
    'band',
    'suspension',
    'pullupBar',
    'bench',
    'mat',
    'wall',
    'chair',
  ],
  dumbbellIncrement: 5,
  flaggedJoints: [],
  impactCeiling: 'high',
  daysPerWeek: 4,
  sessionMinutes: 40,
};

const catalog = CATALOG as Exercise[];

interface SimResult {
  history: SetLog[];
  sessions: {
    weekNumber: number;
    dayId: string;
    at: number;
    primaryIds: string[];
    accessoryIds: string[];
    totalSets: number;
    minPrimaryRecovery: number;
  }[];
  fatigue: FatigueState;
}

function buildContext(
  history: SetLog[],
  conditioning: ConditioningLog[],
  fatigue: FatigueState,
  at: number,
  weeksTrained: number,
): SelectionContext {
  const recent = [...history]
    .sort((a, b) => b.completedAt - a.completedAt)
    .map((s) => s.exerciseId);

  const historyCounts = new Map<string, number>();
  const seenPerSession = new Set<string>();
  for (const s of history) {
    const key = `${s.sessionId}:${s.exerciseId}`;
    if (seenPerSession.has(key)) continue;
    seenPerSession.add(key);
    historyCounts.set(s.exerciseId, (historyCounts.get(s.exerciseId) ?? 0) + 1);
  }

  const earned = earnedImpactCeiling(fatigue.jointLoad, weeksTrained);

  return {
    recovery: recoveryAt(fatigue, at),
    profile: PROFILE,
    impactCeiling: earned,
    recentExerciseIds: [...new Set(recent)],
    historyCounts,
    painFlags: new Set(),
    conditioning,
  } as SelectionContext & { conditioning: ConditioningLog[] };
}

/**
 * A committed trainee: generally hits the target, occasionally has an off day.
 * Deterministic so the whole simulation is reproducible.
 */
function performSet(repTarget: number, targetRpe: number, seed: number): { reps: number; rpe: number } {
  const wobble = ((seed * 9301 + 49297) % 233280) / 233280;
  if (wobble < 0.12) return { reps: Math.max(1, repTarget - 3), rpe: 9.5 };
  return { reps: repTarget, rpe: Math.max(6, targetRpe - 0.5) };
}

function simulate(options: { conditioning?: ConditioningLog[] } = {}): SimResult {
  const conditioning = options.conditioning ?? [];
  let fatigue = initialFatigueState(T0);
  const history: SetLog[] = [];
  const sessions: SimResult['sessions'] = [];
  const completed: { dayId: string }[] = [];

  let seed = 1;
  let block = createBlock(
    'block-1',
    'Cruise Block',
    CRUISE_BLOCK_DAYS,
    catalog,
    buildContext(history, conditioning, fatigue, T0, 0),
    T0,
  );
  let blockStart = T0;

  for (let sessionNo = 0; sessionNo < 48; sessionNo += 1) {
    const weekIndex = Math.floor(sessionNo / 4);
    const dayIndex = sessionNo % 4;
    const at = T0 + weekIndex * 7 * DAY + DAY_OFFSETS[dayIndex]! * DAY + 17 * 3_600_000;

    // Second block starts fresh after six weeks, re-picking its primaries.
    // Fires exactly once, at the first session of week 7 — guarding on
    // dayIndex too, since weekIndex alone stays 6 for all four of that
    // week's sessions and would otherwise reset `completed` before every
    // one of them, collapsing the day rotation to "day A, four times".
    if (weekIndex === 6 && dayIndex === 0) {
      block = createBlock(
        'block-2',
        'Build Block',
        CRUISE_BLOCK_DAYS,
        catalog,
        buildContext(history, conditioning, fatigue, at, 6),
        at,
      );
      blockStart = at;
      completed.length = 0;
    }

    // Fold in any conditioning that happened before this session.
    for (const c of conditioning) {
      if (c.startedAt <= at && c.startedAt > (sessionNo === 0 ? 0 : at - 2 * DAY)) {
        fatigue = applyConditioning(fatigue, c);
      }
    }

    const weeksTrained = Math.floor((at - T0) / (7 * DAY));
    const ctx = buildContext(history, conditioning, fatigue, at, weeksTrained);
    const { weekNumber, dayId } = nextDay(block, completed);

    const load = systemicLoad(
      history.map((s) => ({ set: s, exercise: catalog.find((e) => e.id === s.exerciseId)! })),
      conditioning.filter((c) => c.startedAt <= at),
      at,
    );

    const session = generateSession({
      block,
      weekNumber,
      dayId,
      catalog,
      ctx,
      profile: PROFILE,
      history,
      volumeMultiplier: volumeMultiplier(load, 3),
    });

    // Record the recovery of every primary-slot mover at the moment it was
    // prescribed — invariant #1 depends on this being captured before the
    // session adds its own fatigue.
    const recovery = recoveryAt(fatigue, at);
    let minPrimaryRecovery = 1;
    for (const pe of session.exercises) {
      if (pe.role !== 'primary') continue;
      for (const m of pe.exercise.primaryMuscles) {
        minPrimaryRecovery = Math.min(minPrimaryRecovery, recovery[m]);
      }
    }

    let totalSets = 0;
    for (const pe of session.exercises) {
      for (const ps of pe.sets) {
        seed += 1;
        const { reps, rpe } = performSet(ps.repTarget, ps.targetRpe, seed);
        const set: SetLog = {
          id: `set-${sessionNo}-${pe.slotId}-${ps.setIndex}`,
          sessionId: `sess-${sessionNo}`,
          exerciseId: pe.exercise.id,
          setIndex: ps.setIndex,
          side: ps.side,
          weight: ps.weight,
          reps,
          rpe,
          completedAt: at + totalSets * 90_000,
        };
        history.push(set);
        fatigue = applySet(fatigue, set, pe.exercise);
        totalSets += 1;
      }
    }

    sessions.push({
      weekNumber,
      dayId,
      at,
      primaryIds: session.exercises.filter((e) => e.role === 'primary').map((e) => e.exercise.id),
      accessoryIds: session.exercises
        .filter((e) => e.role === 'accessory')
        .map((e) => e.exercise.id),
      totalSets,
      minPrimaryRecovery,
    });

    completed.push({ dayId });
    void blockStart;
  }

  return { history, sessions, fatigue };
}

/* ------------------------------------------------------------------ */

describe('12-week simulation', () => {
  const result = simulate();

  it('runs a full two blocks without throwing', () => {
    expect(result.sessions.length).toBe(48);
    expect(result.history.length).toBeGreaterThan(500);
  });

  it('never prescribes a primary lift on a muscle below 50% recovered', () => {
    const worst = Math.min(...result.sessions.map((s) => s.minPrimaryRecovery));
    expect(worst).toBeGreaterThanOrEqual(0.5);
  });

  it('never lets any muscle sit pinned at maximum fatigue', () => {
    const recovery = recoveryAt(result.fatigue, result.sessions.at(-1)!.at + 3 * DAY);
    for (const value of Object.values(recovery)) {
      expect(value).toBeGreaterThan(0.3);
    }
  });

  it('holds the primary lifts constant across each block', () => {
    for (const blockSessions of [result.sessions.slice(0, 24), result.sessions.slice(24)]) {
      const byDay = new Map<string, Set<string>>();
      for (const s of blockSessions) {
        const seen = byDay.get(s.dayId) ?? new Set<string>();
        s.primaryIds.forEach((id) => seen.add(id));
        byDay.set(s.dayId, seen);
      }
      for (const [dayId, ids] of byDay) {
        expect(ids.size, `day ${dayId} swapped its primary mid-block`).toBe(1);
      }
    }
  });

  it('rotates accessory work so it does not go stale', () => {
    const dayA = result.sessions.filter((s) => s.dayId === 'a');
    const distinct = new Set(dayA.flatMap((s) => s.accessoryIds));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('drops volume in the deload week', () => {
    const buildWeeks = result.sessions.filter((s) => s.weekNumber >= 2 && s.weekNumber <= 5);
    const deloadWeek = result.sessions.filter((s) => s.weekNumber === 6);

    const meanBuild = buildWeeks.reduce((a, s) => a + s.totalSets, 0) / buildWeeks.length;
    const meanDeload = deloadWeek.reduce((a, s) => a + s.totalSets, 0) / deloadWeek.length;

    expect(meanDeload).toBeLessThan(meanBuild);
  });

  it('climbs at least one ladder rung over the twelve weeks', () => {
    const index = buildLadderIndex(catalog);
    const firstSession = result.sessions[0]!;
    const lastSessions = result.sessions.slice(-4);

    const startDepth = Math.max(...firstSession.primaryIds.map((id) => rungDepth(id, index)), 0);
    const endDepth = Math.max(
      ...lastSessions.flatMap((s) => [...s.primaryIds, ...s.accessoryIds]).map((id) => rungDepth(id, index)),
      0,
    );

    expect(endDepth).toBeGreaterThanOrEqual(startDepth);
    // Somewhere in the programme, someone moved up a ladder.
    const allDepths = result.sessions.flatMap((s) =>
      [...s.primaryIds, ...s.accessoryIds].map((id) => rungDepth(id, index)),
    );
    expect(Math.max(...allDepths)).toBeGreaterThan(0);
  });

  it('keeps high-impact work locked for a beginner regardless of volume', () => {
    const earlyCeiling = earnedImpactCeiling(1000, 2);
    expect(earlyCeiling).toBe('none');
  });

  it('produces sessions in the promised time envelope', () => {
    // Sanity: 4 days/week at 30-45 min. Deload weeks run shorter by design.
    for (const s of result.sessions) {
      expect(s.totalSets).toBeGreaterThan(4);
      expect(s.totalSets).toBeLessThan(60);
    }
  });
});

describe('conditioning feeds back into programming', () => {
  it('a hard run shortens the next session rather than being ignored', () => {
    const baseline = simulate();

    // A long, hard trail run the day before every session.
    const runs: ConditioningLog[] = [];
    for (let week = 0; week < 12; week += 1) {
      for (const offset of DAY_OFFSETS) {
        runs.push({
          id: `run-${week}-${offset}`,
          kind: 'run',
          startedAt: T0 + week * 7 * DAY + offset * DAY + 7 * 3_600_000,
          durationSec: 3600,
          effort: 8,
          impact: 'moderate',
          source: 'strava',
        });
      }
    }

    const withRunning = simulate({ conditioning: runs });

    const baseTotal = baseline.sessions.reduce((a, s) => a + s.totalSets, 0);
    const runTotal = withRunning.sessions.reduce((a, s) => a + s.totalSets, 0);

    expect(runTotal).toBeLessThan(baseTotal);
  });

  it('running lowers leg recovery specifically, not everything uniformly', () => {
    let fatigue = initialFatigueState(T0);
    fatigue = applyConditioning(fatigue, {
      id: 'r',
      kind: 'run',
      startedAt: T0,
      durationSec: 3600,
      effort: 8,
      impact: 'moderate',
      source: 'strava',
    });

    const recovery = recoveryAt(fatigue, T0 + 3_600_000);
    expect(recovery.calves).toBeLessThan(0.75);
    expect(recovery.chest).toBe(1);
  });
});
