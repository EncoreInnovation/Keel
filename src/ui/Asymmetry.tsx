/**
 * Left/right balance — surfacing what `engine/asymmetry.ts` has been
 * computing from every unilateral set logged all along. This is the
 * corrective feature with actual data behind it: a photo can suggest you're
 * shifted right, but a logged rep-and-load gap across weeks either moves or
 * it doesn't. That's a measurement, not a vibe.
 */

import { useEffect, useState } from 'react';
import { asymmetryReport, overallGap, SIGNIFICANT_GAP, type AsymmetryReading } from '../engine/asymmetry';
import { getAllSets } from '../storage/repository';
import { CATALOG_BY_ID } from '../../catalog/exercises';

export interface AsymmetryProps {
  onBack: () => void;
}

function exerciseName(exerciseId: string): string {
  return CATALOG_BY_ID.get(exerciseId)?.name ?? exerciseId;
}

function describeGap(gap: number): string {
  if (Math.abs(gap) < SIGNIFICANT_GAP) return 'Balanced';
  const side = gap > 0 ? 'Right' : 'Left';
  return `${side} ahead by ${Math.round(Math.abs(gap) * 100)}%`;
}

export function Asymmetry({ onBack }: AsymmetryProps) {
  const [readings, setReadings] = useState<AsymmetryReading[] | undefined>();

  useEffect(() => {
    let cancelled = false;
    void getAllSets().then((sets) => {
      if (!cancelled) setReadings(asymmetryReport(sets));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!readings) {
    return <div className="today today--loading">Loading…</div>;
  }

  if (readings.length === 0) {
    return (
      <div className="phase-screen">
        <div className="phase-screen__eyebrow">Left / Right Balance</div>
        <p className="placeholder__body">
          No unilateral sets logged yet. Once you've trained a few single-arm or single-leg
          movements, the gap between sides shows up here.
        </p>
        <button className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  const overall = overallGap(readings);

  return (
    <div className="phase-screen asymmetry">
      <div className="phase-screen__eyebrow">Left / Right Balance</div>
      <div className="asymmetry__overall">{describeGap(overall)}</div>
      <div className="asymmetry__overall-sub">Averaged across every unilateral exercise logged</div>

      <div className="asymmetry__list">
        {readings.map((r) => (
          <div key={r.exerciseId} className="asymmetry__row">
            <div className="asymmetry__row-name">{exerciseName(r.exerciseId)}</div>
            <div className={`asymmetry__row-gap${r.significant ? ' asymmetry__row-gap--significant' : ''}`}>
              {describeGap(r.gap)}
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
