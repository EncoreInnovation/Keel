/**
 * Front/back body silhouettes with one hotspot per muscle region — shared by
 * the recovery heat map and the per-exercise muscle diagram, so both read as
 * the same body. Geometry is deliberately simple; a future art pass can swap
 * these shapes without touching any caller.
 */

import type { Muscle } from '../engine/types';

export interface Hotspot {
  muscle: Muscle;
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
}

export const FRONT_HOTSPOTS: Hotspot[] = [
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

export const BACK_HOTSPOTS: Hotspot[] = [
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

export interface BodySilhouetteProps {
  label: string;
  hotspots: Hotspot[];
  fillFor: (muscle: Muscle) => string;
  /** Rendered height in px; width follows the 128×200 aspect ratio. */
  height?: number;
  showLabel?: boolean;
}

export function BodySilhouette({ label, hotspots, fillFor, height = 200, showLabel = true }: BodySilhouetteProps) {
  const width = Math.round((height * 128) / 200);
  return (
    <div className="recovery-map__figure">
      <svg viewBox="0 0 128 200" width={width} height={height} role="img" aria-label={`${label} view`}>
        {/* A soft outline so the hotspots read as "on a body," not floating shapes. */}
        <ellipse cx="64" cy="15" rx="12" ry="13" fill="var(--surface-2)" />
        <rect x="30" y="30" width="68" height="70" rx="14" fill="var(--surface-2)" />
        <rect x="34" y="98" width="60" height="90" rx="16" fill="var(--surface-2)" />
        {hotspots.map((h, i) => (
          <rect key={`${h.muscle}-${i}`} x={h.x} y={h.y} width={h.w} height={h.h} rx={h.rx ?? 4} fill={fillFor(h.muscle)} />
        ))}
      </svg>
      {showLabel && <div className="recovery-map__figure-label">{label}</div>}
    </div>
  );
}
