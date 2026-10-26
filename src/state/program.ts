/**
 * Dig Deeper mode: loading the plan, logging a workout, logging a finisher,
 * and deciding which finishers to offer after today's workout.
 */

import { CATALOG } from '../../catalog/exercises';
import { recoveryAt } from '../engine/recovery';
import type { ConditioningLog, Exercise, Gym, Muscle, MuscleMap, ProgramSettings, UserProfile } from '../engine/types';
import type { ProgramDay } from './recommendations';
import { computeDDPlan, DD_BY_ID, DEFAULT_DD_SETTINGS, ymd, type DDLog, type DDPlan } from '../programs/digDeeper';
import { nextSessionNumber, saunaVisits, type FinisherKind, type FinisherResult } from '../programs/finishers';
import * as repo from '../storage/repository';
import { rebuildFatigue } from './sessionController';

export interface ProgramState {
  settings: ProgramSettings;
  logs: DDLog[];
  plan: DDPlan;
  /** Dig Deeper is the program and still has workouts left. */
  active: boolean;
}

export function programSettings(profile: UserProfile): ProgramSettings {
  return profile.program ?? { kind: 'dig-deeper', ...DEFAULT_DD_SETTINGS };
}

export async function loadProgram(profile: UserProfile, now: number): Promise<ProgramState> {
  const settings = programSettings(profile);
  const logs = await repo.getProgramLogs();
  const plan = computeDDPlan(settings, logs, ymd(new Date(now)));
  return { settings, logs, plan, active: settings.kind === 'dig-deeper' && !plan.complete };
}

/** What recommendations need to know about a Dig Deeper day. */
export function programDay(state: ProgramState, readiness: number | undefined): ProgramDay {
  const slot = state.plan.today;
  const muscles = slot ? DD_BY_ID.get(slot.workoutId)?.muscles ?? {} : {};
  return {
    readiness,
    trainedToday: state.plan.loggedToday.some((l) => l.type === 'completed' || l.type === 'substitute'),
    muscles: (Object.entries(muscles) as [Muscle, number][]).filter(([, v]) => v >= 0.5).map(([m]) => m),
  };
}

export interface WorkoutLogInput {
  type: DDLog['type'];
  date: string;
  slotId?: string;
  scheduledWorkoutId?: string;
  performedWorkoutId?: string;
  durationMin?: number;
  effort?: number;
  rows?: DDLog['rows'];
  painNotes?: string;
  notes?: string;
}

/** Saves a Dig Deeper log, plus the fatigue entry for anything actually trained. */
export async function logWorkout(input: WorkoutLogInput, now: number): Promise<DDLog> {
  const entry: DDLog = { id: `dd-${now}`, createdAt: now, ...input };
  const workout = input.performedWorkoutId ? DD_BY_ID.get(input.performedWorkoutId) : undefined;
  const trained = (input.type === 'completed' || input.type === 'substitute') && workout;
  const minutes = input.durationMin ?? workout?.minutes ?? 0;
  const fatigue: ConditioningLog | undefined = trained
    ? {
        id: '',
        kind: 'dig-deeper',
        // A log made later for an earlier date still lands on that date.
        startedAt: input.date === ymd(new Date(now)) ? now - minutes * 60_000 : new Date(`${input.date}T12:00:00`).getTime(),
        durationSec: minutes * 60,
        effort: input.effort ?? 7,
        impact: 'low',
        source: 'manual',
        muscles: workout.muscles,
      }
    : undefined;
  await repo.saveProgramLog(entry, fatigue);
  return entry;
}

const IMPACT: Record<FinisherKind, ConditioningLog['impact']> = { stairs: 'low', rope: 'moderate', sauna: 'none' };
const EFFORT = { easy: 5, right: 7, hard: 9 } as const;

export async function logFinisher(kind: FinisherKind, sessionNumber: number, result: FinisherResult, now: number): Promise<void> {
  await repo.appendConditioningLog({
    id: `fin-${kind}-${now}`,
    kind,
    startedAt: now - result.elapsedSec * 1000,
    durationSec: result.elapsedSec,
    effort: kind === 'sauna' ? 1 : result.rating ? EFFORT[result.rating] : 7,
    impact: IMPACT[kind],
    source: 'manual',
    finisherSession: kind === 'sauna' ? undefined : sessionNumber,
    rating: result.rating,
  });
}

export interface FinisherPick {
  kind: FinisherKind;
  /** Session number to do next (stairs, rope); sauna visits so far for the sauna. */
  number: number;
  /** Why it's shown, or why it's not today's best pick. */
  note?: string;
}

/** What to offer after today's workout at this gym. */
export async function finisherPicks(gym: Gym, now: number): Promise<FinisherPick[]> {
  const [conditioning, sets] = await Promise.all([repo.getConditioningLogs(), repo.getAllSets()]);
  const catalogById = new Map((CATALOG as Exercise[]).map((e) => [e.id, e]));
  const recovery: MuscleMap = recoveryAt(rebuildFatigue(sets, conditioning, catalogById, now), now);
  const hasStairs = gym.equipment.includes('stairClimber');
  const calvesTired = recovery.calves < 0.5;

  const picks: FinisherPick[] = [];
  if (hasStairs) picks.push({ kind: 'stairs', number: nextSessionNumber(conditioning, 'stairs') });
  picks.push({
    kind: 'rope',
    number: nextSessionNumber(conditioning, 'rope'),
    note: calvesTired ? (hasStairs ? 'Calves are still tired — stairs are the better pick today.' : 'Calves are still tired — rest them today.') : undefined,
  });
  if (gym.sauna) picks.push({ kind: 'sauna', number: saunaVisits(conditioning) });
  return picks;
}
