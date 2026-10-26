/** Gathers what `recommendSessions` needs from storage. */

import { recoveryAt } from '../engine/recovery';
import { isSameCalendarDay } from '../engine/time';
import type { Exercise, Muscle, PrescribedSession } from '../engine/types';
import { recommendSessions, type Recommendation } from '../pillars/recommend';
import { alignmentSummary } from '../posture/describe';
import * as repo from '../storage/repository';
import { rebuildFatigue } from './sessionController';

const TWO_DAYS_MS = 2 * 86_400_000;

/** Calendar days from one moment to another, local time. */
function calendarDaysBetween(from: number, to: number): number {
  const day = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  };
  return Math.round(day(to) - day(from));
}

/**
 * What an outside program (Dig Deeper) knows that COLOSSUS's session record
 * doesn't: today's readiness answer, whether today's workout is logged, and
 * which muscles it trains.
 */
export interface ProgramDay {
  readiness?: number;
  trainedToday: boolean;
  muscles: Muscle[];
  restDay?: boolean;
}

export async function loadRecommendations(
  catalog: Exercise[],
  prescription: PrescribedSession | undefined,
  now: number,
  programDay?: ProgramDay,
): Promise<Recommendation[]> {
  const [pillarLogs, record, sets, conditioning, completed, postureLogs] = await Promise.all([
    repo.getPillarLogs(),
    repo.getActiveSessionRecord(),
    repo.getAllSets(),
    repo.getConditioningLogs(),
    repo.getCompletedSessions(),
    repo.getPostureLogs(),
  ]);

  const done = pillarLogs.filter((l) => l.completedAt);
  const catalogById = new Map(catalog.map((e) => [e.id, e]));
  const recovery = recoveryAt(rebuildFatigue(sets, conditioning, catalogById, now), now);
  const trainedMuscles = programDay?.muscles ?? prescription?.exercises.flatMap((e) => e.exercise.primaryMuscles) ?? [];
  const alignment = alignmentSummary(postureLogs, now);
  const lastHipFlow = done
    .filter((l) => l.kind === 'hipflow')
    .map((l) => l.completedAt!)
    .sort((a, b) => a - b)
    .at(-1);

  return recommendSessions({
    hour: new Date(now).getHours(),
    pelvicDoneToday: done.some((l) => l.kind === 'pelvic' && isSameCalendarDay(l.completedAt!, now)),
    readiness: programDay ? programDay.readiness : record && isSameCalendarDay(record.startedAt, now) ? record.readiness : undefined,
    lowestRecovery: trainedMuscles.length ? Math.min(...trainedMuscles.map((m) => recovery[m])) : undefined,
    trainedToday:
      (programDay?.trainedToday ?? false) || completed.some((s) => s.completedAt !== undefined && isSameCalendarDay(s.completedAt, now)),
    postureTilt: alignment && alignment.side !== 'level' ? alignment.headline : undefined,
    realignInLastTwoDays: done.some((l) => l.kind === 'realign' && now - l.completedAt! < TWO_DAYS_MS),
    hipFlowDaysSince: lastHipFlow === undefined ? undefined : calendarDaysBetween(lastHipFlow, now),
    restDay: programDay?.restDay,
  });
}
