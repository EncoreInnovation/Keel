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
import {
  appendBodyMetric,
  getAllSets,
  getBodyMetrics,
  getCompletedSessions,
  getPillarLogs,
} from '../storage/repository';
import type { BodyMetricLog, Exercise, SetLog } from '../engine/types';

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

function Sparkline({ points }: { points: { at: number; value: number }[] }) {
  const width = 260;
  const height = 48;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? width / 2 : (i / (points.length - 1)) * width;
    const y = height - ((p.value - min) / range) * height;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="sparkline">
      <polyline points={coords.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {coords.map((c, i) => {
        const [x, y] = c.split(',');
        return <circle key={i} cx={x} cy={y} r="2.5" fill="var(--accent)" />;
      })}
    </svg>
  );
}

export interface ProgressProps {
  onBack: () => void;
  onOpenAsymmetry: () => void;
}

export function Progress({ onBack, onOpenAsymmetry }: ProgressProps) {
  const [sets, setSets] = useState<SetLog[] | undefined>();
  const [weeksTrained, setWeeksTrained] = useState(0);
  const [pillarMinutes, setPillarMinutes] = useState(0);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetricLog[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [asymmetryGap, setAsymmetryGap] = useState(0);

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

  const handleSaveWeight = async () => {
    const value = Number(weightInput);
    if (!value) return;
    await appendBodyMetric({ id: `bm-${Date.now()}`, at: Date.now(), weight: value });
    setWeightInput('');
    await refresh();
  };

  return (
    <div className="phase-screen progress-screen">
      <div className="phase-screen__eyebrow">Progress</div>

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
          e1rmSeries.slice(0, 4).map((series) => (
            <div key={series.exerciseId} className="progress-lift">
              <div className="progress-lift__header">
                <span>{series.name}</span>
                <span data-numeric>{Math.round(series.points.at(-1)!.value)} lb</span>
              </div>
              <Sparkline points={series.points} />
            </div>
          ))
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
        <h2 className="progress-section__title">Weight</h2>
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
            placeholder="Today's weight"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
          />
          <button className="btn btn--ghost" onClick={() => void handleSaveWeight()}>
            Save
          </button>
        </div>
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
