/** Gathers what `recommendSessions` needs from storage. */

import { recoveryAt } from '../engine/recovery';
import { isSameCalendarDay } from '../engine/time';
import type { Exercise, PrescribedSession } from '../engine/types';
import { recommendSessions, type Recommendation } from '../pillars/recommend';
import { alignmentSummary } from '../posture/describe';
import * as repo from '../storage/repository';
import { rebuildFatigue } from './sessionController';

const TWO_DAYS_MS = 2 * 86_400_000;

export async function loadRecommendations(
  catalog: Exercise[],
  prescription: PrescribedSession | undefined,
  now: number,
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
  const trainedMuscles = prescription?.exercises.flatMap((e) => e.exercise.primaryMuscles) ?? [];
  const alignment = alignmentSummary(postureLogs, now);

  return recommendSessions({
    hour: new Date(now).getHours(),
    pelvicDoneToday: done.some((l) => l.kind === 'pelvic' && isSameCalendarDay(l.completedAt!, now)),
    readiness: record && isSameCalendarDay(record.startedAt, now) ? record.readiness : undefined,
    lowestRecovery: trainedMuscles.length ? Math.min(...trainedMuscles.map((m) => recovery[m])) : undefined,
    trainedToday: completed.some((s) => s.completedAt !== undefined && isSameCalendarDay(s.completedAt, now)),
    postureTilt: alignment && alignment.side !== 'level' ? alignment.headline : undefined,
    realignInLastTwoDays: done.some((l) => l.kind === 'realign' && now - l.completedAt! < TWO_DAYS_MS),
  });
}
