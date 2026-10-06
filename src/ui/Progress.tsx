/**
 * Progress — the feedback loop that answers "is this working."
 *
 * e1RM trend per lift that's ever been a locked primary, ladder rungs
 * climbed on bodyweight/band work, weeks trained, pillar minutes, weight,
 * and a link out to the fuller left/right balance view. Every number here
 * is derived straight from the flat sets log and the other flat logs —
 * nothing is precomputed or cached, so it can never drift from what's
 * actually been logged.
 */

import { useEffect, useState } from 'react';
import { bestE1RM } from '../engine/overload';
import { buildLadderIndex, rungDepth } from '../engine/ladders';
import { asymmetryReport, overallGap } from '../engine/asymmetry';
import { CATALOG } from '../../catalog/exercises';
import { askCoach } from '../ai/client';
import { buildWeeklyReflectionPrompt, summarizeWeek } from '../ai/prompts';
import {
  appendBodyMetric,
  getAllSets,
  getBodyMetrics,
  getCompletedSessions,
  getConditioningLogs,
  getPillarLogs,
} from '../storage/repository';
import type { BodyMetricLog, Exercise, SetLog } from '../engine/types';
import { TrendChart } from './charts/TrendChart';

const WEEK_MS = 7 * 86_400_000;

const catalog = CATALOG as Exercise[];
const catalogById = new Map(catalog.map((e) => [e.id, e]));
const ladderIndex = buildLadderIndex(catalog);

interface E1rmSeries {
  exerciseId: string;
  name: string;
  points: { at: number; value: number }[];
}

function computeE1rmSeries(sets: SetLog[]): E1rmSeries[] {
  const bySessionExercise = new Map<string, SetLog[]>();
  for (const set of sets) {
    const exercise = catalogById.get(set.exerciseId);
    if (!exercise || exercise.loadType !== 'external') continue;
    const key = `${set.sessionId}:${set.exerciseId}`;
    const bucket = bySessionExercise.get(key) ?? [];
    bucket.push(set);
    bySessionExercise.set(key, bucket);
  }

  const byExercise = new Map<string, { at: number; value: number }[]>();
  for (const [key, bucket] of bySessionExercise) {
    const exerciseId = key.split(':')[1]!;
    const value = bestE1RM(bucket);
    if (value <= 0) continue;
    const at = Math.max(...bucket.map((s) => s.completedAt));
    const points = byExercise.get(exerciseId) ?? [];
    points.push({ at, value });
    byExercise.set(exerciseId, points);
  }

  return [...byExercise.entries()]
    .map(([exerciseId, points]) => ({
      exerciseId,
      name: catalogById.get(exerciseId)?.name ?? exerciseId,
      points: points.sort((a, b) => a.at - b.at).slice(-12),
    }))
    .filter((s) => s.points.length > 0)
    .sort((a, b) => b.points.length - a.points.length);
}

export interface ProgressProps {
  onBack: () => void;
  onOpenAsymmetry: () => void;
  onOpenPhysique: () => void;
  onNewPhysique: () => void;
}

export function Progress({ onBack, onOpenAsymmetry, onOpenPhysique, onNewPhysique }: ProgressProps) {
  const [sets, setSets] = useState<SetLog[] | undefined>();
  const [weeksTrained, setWeeksTrained] = useState(0);
  const [pillarMinutes, setPillarMinutes] = useState(0);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetricLog[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [waistInput, setWaistInput] = useState('');
  const [asymmetryGap, setAsymmetryGap] = useState(0);
  const [reflection, setReflection] = useState<string | undefined>();
  const [reflectionError, setReflectionError] = useState<string | undefined>();
  const [reflectionBusy, setReflectionBusy] = useState(false);

  async function refresh() {
    const [allSets, completed, pillarLogs, metrics] = await Promise.all([
      getAllSets(),
      getCompletedSessions(),
      getPillarLogs(),
      getBodyMetrics(),
    ]);
    setSets(allSets);
    setWeeksTrained(new Set(completed.map((s) => `${s.blockId}-${s.weekNumber}`)).size);
    const minutes = pillarLogs.reduce((sum, p) => {
      if (!p.completedAt) return sum;
      return sum + (p.completedAt - p.startedAt) / 60_000;
    }, 0);
    setPillarMinutes(Math.round(minutes));
    setBodyMetrics(metrics);
    setAsymmetryGap(overallGap(asymmetryReport(allSets)));
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (!sets) {
    return <div className="today today--loading">Loading…</div>;
  }

  const e1rmSeries = computeE1rmSeries(sets);

  const ladderExercises = [...new Set(sets.map((s) => s.exerciseId))]
    .map((id) => ({ id, exercise: catalogById.get(id), depth: rungDepth(id, ladderIndex) }))
    .filter((x) => x.exercise && x.exercise.loadType !== 'external' && x.depth > 0)
    .sort((a, b) => b.depth - a.depth);

  const latestWeight = bodyMetrics.at(-1);
  const firstWeight = bodyMetrics.find((m) => m.weight !== undefined);
  const weightDelta =
    latestWeight?.weight !== undefined && firstWeight?.weight !== undefined
      ? latestWeight.weight - firstWeight.weight
      : undefined;

  const weightPoints = bodyMetrics.filter((m) => m.weight !== undefined).map((m) => ({ at: m.at, value: m.weight! }));
  const waistPoints = bodyMetrics
    .filter((m) => m.measurements?.waist !== undefined)
    .map((m) => ({ at: m.at, value: m.measurements!.waist! }));

  const handleSaveWeight = async () => {
    const weight = Number(weightInput) || undefined;
    const waist = Number(waistInput) || undefined;
    if (!weight && !waist) return;
    await appendBodyMetric({
      id: `bm-${Date.now()}`,
      at: Date.now(),
      weight,
      measurements: waist ? { waist } : undefined,
    });
    setWeightInput('');
    setWaistInput('');
    await refresh();
  };

  const handleGetReflection = async () => {
    setReflectionBusy(true);
    setReflectionError(undefined);
    setReflection(undefined);

    const since = Date.now() - WEEK_MS;
    const [completed, pillarLogs, conditioning] = await Promise.all([
      getCompletedSessions(),
      getPillarLogs(),
      getConditioningLogs(),
    ]);

    const weekSets = sets.filter((s) => s.completedAt >= since);
    const weekCompleted = completed.filter((s) => s.startedAt >= since);
    const weekPillar = pillarLogs.filter((p) => p.startedAt >= since);
    const weekConditioning = conditioning.filter((c) => c.startedAt >= since);

    const summary = summarizeWeek({
      weekLabel: 'The last 7 days',
      sets: weekSets,
      completedSessionCount: weekCompleted.length,
      catalog,
      pillarLogs: weekPillar,
      conditioning: weekConditioning,
    });

    const result = await askCoach(buildWeeklyReflectionPrompt(summary));
    setReflectionBusy(false);
    if (result.ok) setReflection(result.text);
    else setReflectionError(result.error);
  };

  return (
    <div className="phase-screen progress-screen">
      <div className="phase-screen__eyebrow">Progress</div>
      <p className="screen-explainer">
        Is it working? Strength should climb and waist should shrink. Check once a week, right
        after the weekly weigh-in — day-to-day numbers are noise.
      </p>

      <div className="progress-stats">
        <div className="progress-stat">
          <div className="progress-stat__value" data-numeric>
            {weeksTrained}
          </div>
          <div className="progress-stat__label">Weeks trained</div>
        </div>
        <div className="progress-stat">
          <div className="progress-stat__value" data-numeric>
            {pillarMinutes}
          </div>
          <div className="progress-stat__label">Pillar minutes</div>
        </div>
        <div className="progress-stat">
          <div className="progress-stat__value" data-numeric>
            {Math.round(asymmetryGap * 100)}%
          </div>
          <div className="progress-stat__label">L/R gap</div>
        </div>
      </div>

      <section className="progress-section">
        <h2 className="progress-section__title">Strength (e1RM)</h2>
        {e1rmSeries.length === 0 ? (
          <p className="placeholder__body">Log a loaded set to start a trend line.</p>
        ) : (
          e1rmSeries
            .slice(0, 6)
            .map((series) => <TrendChart key={series.exerciseId} title={series.name} points={series.points} unit="lb" />)
        )}
      </section>

      <section className="progress-section">
        <h2 className="progress-section__title">Ladders</h2>
        {ladderExercises.length === 0 ? (
          <p className="placeholder__body">Rungs climbed on bodyweight and band work show up here.</p>
        ) : (
          <ul className="progress-list">
            {ladderExercises.slice(0, 5).map((x) => (
              <li key={x.id} className="progress-list__row">
                <span>{x.exercise!.name}</span>
                <span data-numeric>Rung {x.depth}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="progress-section">
        <h2 className="progress-section__title">Body</h2>
        <TrendChart title="Bodyweight" points={weightPoints} unit="lb" lowerIsBetter />
        <TrendChart title="Waist" points={waistPoints} unit="in" lowerIsBetter />
        {latestWeight?.weight !== undefined ? (
          <p className="progress-weight">
            <span data-numeric>{latestWeight.weight} lb</span>
            {weightDelta !== undefined && weightDelta !== 0 && (
              <span className="progress-weight__delta" data-numeric>
                {weightDelta > 0 ? '+' : ''}
                {Math.round(weightDelta * 10) / 10} since first log
              </span>
            )}
          </p>
        ) : (
          <p className="placeholder__body">No weight logged yet.</p>
        )}
        <div className="progress-weight-entry">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Weight (lb)"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Waist (in)"
            value={waistInput}
            onChange={(e) => setWaistInput(e.target.value)}
          />
          <button className="btn btn--ghost" onClick={() => void handleSaveWeight()}>
            Save
          </button>
        </div>
      </section>

      <section className="progress-section">
        <h2 className="progress-section__title">Physique photos</h2>
        <div className="checkin-card__row">
          <button className="btn btn--ghost" onClick={onNewPhysique}>
            New check-in
          </button>
          <button className="btn btn--ghost" onClick={onOpenPhysique}>
            Compare
          </button>
        </div>
      </section>

      <section className="progress-section">
        <h2 className="progress-section__title">Weekly reflection</h2>
        {reflection ? (
          <div className="coach-note">{reflection}</div>
        ) : (
          <p className="placeholder__body">A short AI read on the last 7 days, generated on demand.</p>
        )}
        {reflectionError && <div className="posture-scan__error">{reflectionError}</div>}
        <button className="btn btn--ghost" disabled={reflectionBusy} onClick={() => void handleGetReflection()}>
          {reflectionBusy ? 'Thinking…' : reflection ? 'Regenerate' : 'Get weekly reflection'}
        </button>
      </section>

      <button className="btn btn--text" onClick={onOpenAsymmetry}>
        Full left / right balance
      </button>
      <button className="btn btn--ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
