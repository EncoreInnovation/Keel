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
import { CATALOG } from '../../catalog/exercises';
import { rebuildFatigue } from '../state/sessionController';
import { recoveryAt, systemicLoad } from '../engine/recovery';
import { getAllSets, getConditioningLogs } from '../storage/repository';

const CATALOG_BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

/** Mirrors the --data-0..--data-4 ramp in tokens.css — recovered (teal) to fatigued (amber). */
const DATA_RAMP = ['#4ad9c0', '#6fd08c', '#b8cc5e', '#e8b04b', '#e07a4a'];

function colorForRecovery(recovery: number): string {
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

interface Hotspot {
  muscle: Muscle;
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
}

const FRONT_HOTSPOTS: Hotspot[] = [
  { muscle: 'neck', x: 55, y: 18, w: 14, h: 12, rx: 4 },
  { muscle: 'shoulders', x: 24, y: 34, w: 16, h: 14, rx: 6 },
  { muscle: 'shoulders', x: 84, y: 34, w: 16, h: 14, rx: 6 },
  { muscle: 'chest', x: 40, y: 36, w: 44, h: 24, rx: 6 },
  { muscle: 'biceps', x: 18, y: 50, w: 14, h: 30, rx: 6 },
  { muscle: 'biceps', x: 92, y: 50, w: 14, h: 30, rx: 6 },
  { muscle: 'forearms', x: 14, y: 82, w: 14, h: 30, rx: 5 },
  { muscle: 'forearms', x: 96, y: 82, w: 14, h: 30, rx: 5 },
  { muscle: 'abs', x: 44, y: 62, w: 36, h: 34, rx: 6 },
  { muscle: 'adductors', x: 50, y: 98, w: 24, h: 14, rx: 5 },
  { muscle: 'quads', x: 38, y: 114, w: 22, h: 46, rx: 8 },
  { muscle: 'quads', x: 64, y: 114, w: 22, h: 46, rx: 8 },
];

const BACK_HOTSPOTS: Hotspot[] = [
  { muscle: 'neck', x: 55, y: 18, w: 14, h: 10, rx: 4 },
  { muscle: 'shoulders', x: 24, y: 34, w: 16, h: 14, rx: 6 },
  { muscle: 'shoulders', x: 84, y: 34, w: 16, h: 14, rx: 6 },
  { muscle: 'upperBack', x: 40, y: 34, w: 44, h: 22, rx: 6 },
  { muscle: 'lats', x: 32, y: 52, w: 22, h: 26, rx: 8 },
  { muscle: 'lats', x: 70, y: 52, w: 22, h: 26, rx: 8 },
  { muscle: 'triceps', x: 18, y: 50, w: 14, h: 30, rx: 6 },
  { muscle: 'triceps', x: 92, y: 50, w: 14, h: 30, rx: 6 },
  { muscle: 'lowerBack', x: 44, y: 78, w: 36, h: 18, rx: 6 },
  { muscle: 'glutes', x: 38, y: 98, w: 48, h: 20, rx: 10 },
  { muscle: 'hamstrings', x: 38, y: 120, w: 22, h: 40, rx: 8 },
  { muscle: 'hamstrings', x: 64, y: 120, w: 22, h: 40, rx: 8 },
  { muscle: 'calves', x: 40, y: 162, w: 18, h: 26, rx: 7 },
  { muscle: 'calves', x: 66, y: 162, w: 18, h: 26, rx: 7 },
];

function Silhouette({ label, hotspots, recovery }: { label: string; hotspots: Hotspot[]; recovery: MuscleMap }) {
  return (
    <div className="recovery-map__figure">
      <svg viewBox="0 0 128 200" width="128" height="200" role="img" aria-label={`${label} view`}>
        {/* A soft outline so the hotspots read as "on a body," not floating shapes. */}
        <ellipse cx="64" cy="15" rx="12" ry="13" fill="var(--surface-2)" />
        <rect x="30" y="30" width="68" height="70" rx="14" fill="var(--surface-2)" />
        <rect x="34" y="98" width="60" height="90" rx="16" fill="var(--surface-2)" />
        {hotspots.map((h, i) => (
          <rect
            key={`${h.muscle}-${i}`}
            x={h.x}
            y={h.y}
            width={h.w}
            height={h.h}
            rx={h.rx ?? 4}
            fill={colorForRecovery(recovery[h.muscle])}
          />
        ))}
      </svg>
      <div className="recovery-map__figure-label">{label}</div>
    </div>
  );
}

const MUSCLE_LABEL: Record<Muscle, string> = {
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
        <Silhouette label="Front" hotspots={FRONT_HOTSPOTS} recovery={recovery} />
        <Silhouette label="Back" hotspots={BACK_HOTSPOTS} recovery={recovery} />
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
