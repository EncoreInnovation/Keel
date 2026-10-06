/**
 * Which muscles an exercise works, lit up on the body: primary movers in
 * solid purple, secondary movers in a lighter tint. Purple, not the recovery
 * ramp or gold — this is "what this works," never a data reading or an
 * achievement. Pure SVG, so it works offline.
 */

import type { Exercise, Muscle } from '../engine/types';
import { BACK_HOTSPOTS, BodySilhouette, FRONT_HOTSPOTS } from './BodyMap';

export type Emphasis = 'primary' | 'secondary' | 'none';

export function muscleEmphasis(exercise: Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>, muscle: Muscle): Emphasis {
  if (exercise.primaryMuscles.includes(muscle)) return 'primary';
  if (exercise.secondaryMuscles.includes(muscle)) return 'secondary';
  return 'none';
}

const FILL: Record<Emphasis, string> = {
  primary: 'var(--accent)',
  secondary: 'var(--accent-soft)',
  none: 'var(--surface-3)',
};

export interface MuscleDiagramProps {
  exercise: Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles' | 'name'>;
  /** Height of each figure in px. */
  height?: number;
  showLabels?: boolean;
}

export function MuscleDiagram({ exercise, height = 72, showLabels = false }: MuscleDiagramProps) {
  const fillFor = (m: Muscle) => FILL[muscleEmphasis(exercise, m)];
  return (
    <div className="muscle-diagram" aria-label={`Muscles worked by ${exercise.name}`}>
      <BodySilhouette label="Front" hotspots={FRONT_HOTSPOTS} fillFor={fillFor} height={height} showLabel={showLabels} />
      <BodySilhouette label="Back" hotspots={BACK_HOTSPOTS} fillFor={fillFor} height={height} showLabel={showLabels} />
    </div>
  );
}
