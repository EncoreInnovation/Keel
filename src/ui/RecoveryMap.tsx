/**
 * Recovery — the muscle-recovery heat map.
 *
 * Two simple silhouettes (front/back) rather than one anatomically precise
 * illustration: fifteen geometric hotspots convey "which muscle, how
 * recovered" exactly as well as a polished asset would, and shipping that
 * asset is real illustration work that doesn't need to block this feature
 * from existing. A future pass can swap the shapes for real artwork without
 * touching the data layer at all.
 */

import { useEffect, useState } from 'react';
import { MUSCLES, type Muscle, type MuscleMap } from '../engine/types';
import { BACK_HOTSPOTS, BodySilhouette, FRONT_HOTSPOTS } from './BodyMap';
import { CATALOG } from '../../catalog/exercises';
import { rebuildFatigue } from '../state/sessionController';
import { recoveryAt, systemicLoad } from '../engine/recovery';
import { getAllSets, getConditioningLogs } from '../storage/repository';

const CATALOG_BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

/** Mirrors the --data-0..--data-4 ramp in tokens.css — recovered (teal) to fatigued (amber). */
const DATA_RAMP = ['#4ad9c0', '#6fd08c', '#b8cc5e', '#e8b04b', '#e07a4a'];

export function colorForRecovery(recovery: number): string {
  // recovery 1 (fully recovered) -> ramp[0]; recovery 0 (fatigued) -> ramp[4].
  const t = Math.min(1, Math.max(0, 1 - recovery)) * (DATA_RAMP.length - 1);
  const lo = Math.floor(t);
  const hi = Math.min(DATA_RAMP.length - 1, lo + 1);
  const frac = t - lo;
  return lerpHex(DATA_RAMP[lo]!, DATA_RAMP[hi]!, frac);
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bch = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r}, ${g}, ${bch})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest',
  upperBack: 'Upper back',
  lats: 'Lats',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  lowerBack: 'Lower back',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  adductors: 'Adductors',
  neck: 'Neck',
};

export interface RecoveryMapProps {
  onBack: () => void;
}

export function RecoveryMap({ onBack }: RecoveryMapProps) {
  const [recovery, setRecovery] = useState<MuscleMap | undefined>();
  const [load, setLoad] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sets, conditioning] = await Promise.all([getAllSets(), getConditioningLogs()]);
      if (cancelled) return;
      const now = Date.now();
      const fatigue = rebuildFatigue(sets, conditioning, CATALOG_BY_ID, now);
      setRecovery(recoveryAt(fatigue, now));
      setLoad(
        systemicLoad(
          sets.map((s) => ({ set: s, exercise: CATALOG_BY_ID.get(s.exerciseId)! })).filter((x) => x.exercise),
          conditioning,
          now,
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!recovery) {
    return <div className="today today--loading">Loading…</div>;
  }

  const sortedMuscles = [...MUSCLES].sort((a, b) => recovery[a] - recovery[b]);

  return (
    <div className="phase-screen recovery-map">
      <div className="phase-screen__eyebrow">Recovery</div>

      <div className="recovery-map__figures">
        <BodySilhouette label="Front" hotspots={FRONT_HOTSPOTS} fillFor={(m) => colorForRecovery(recovery[m])} />
        <BodySilhouette label="Back" hotspots={BACK_HOTSPOTS} fillFor={(m) => colorForRecovery(recovery[m])} />
      </div>

      <div className="recovery-map__load">
        Systemic load, trailing 7 days: <span data-numeric>{Math.round(load * 100)}%</span>
      </div>

      <div className="recovery-map__bars">
        {sortedMuscles.map((m) => (
          <div key={m} className="recovery-map__bar-row">
            <div className="recovery-map__bar-label">{MUSCLE_LABEL[m]}</div>
            <div className="recovery-map__bar-track">
              <div
                className="recovery-map__bar-fill"
                style={{ width: `${Math.round(recovery[m] * 100)}%`, background: colorForRecovery(recovery[m]) }}
              />
            </div>
            <div className="recovery-map__bar-pct" data-numeric>
              {Math.round(recovery[m] * 100)}%
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn--ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
