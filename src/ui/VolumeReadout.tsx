/**
 * Weekly volume readout — how each muscle's hard-set count this week sits
 * against the 10–20 landmark the split is built to hit (`engine/volume.ts`).
 *
 * Scoped to the muscles this programme gives dedicated hypertrophy slots.
 * Muscles like abs and lower back rack up real volume as a secondary mover
 * on nearly every compound lift — showing them here against the same 10–20
 * landmark would just read as a false "way over" warning for something
 * that was never the target in the first place.
 */

import { useEffect, useState } from 'react';
import { CATALOG } from '../../catalog/exercises';
import type { Muscle, MuscleMap } from '../engine/types';
import { VOLUME_LANDMARK_MAX, VOLUME_LANDMARK_MIN, volumeStatus, weeklyMuscleVolume } from '../engine/volume';
import { getAllSets } from '../storage/repository';
import { MUSCLE_LABEL } from './RecoveryMap';

const CATALOG_BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

const TRACKED_MUSCLES: Muscle[] = [
  'chest',
  'upperBack',
  'lats',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
];

const STATUS_LABEL: Record<ReturnType<typeof volumeStatus>, string> = {
  under: 'under',
  'in-range': 'on track',
  over: 'over',
};

export function VolumeReadout() {
  const [volume, setVolume] = useState<MuscleMap | undefined>();

  useEffect(() => {
    let cancelled = false;
    void getAllSets().then((sets) => {
      if (cancelled) return;
      setVolume(weeklyMuscleVolume(sets, CATALOG_BY_ID, Date.now()));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!volume) return null;

  return (
    <div className="today__section">
      <div className="today__section-title">This week&rsquo;s volume</div>
      <div className="volume-readout">
        {TRACKED_MUSCLES.map((m) => {
          const sets = volume[m];
          const status = volumeStatus(sets);
          const fillPct = Math.min(100, (sets / VOLUME_LANDMARK_MAX) * 100);
          return (
            <div key={m} className="volume-readout__row">
              <div className="volume-readout__label">{MUSCLE_LABEL[m]}</div>
              <div className="volume-readout__track">
                <div
                  className={`volume-readout__fill volume-readout__fill--${status}`}
                  style={{ width: `${fillPct}%` }}
                />
                <div
                  className="volume-readout__floor-mark"
                  style={{ left: `${(VOLUME_LANDMARK_MIN / VOLUME_LANDMARK_MAX) * 100}%` }}
                />
              </div>
              <div className="volume-readout__count" data-numeric>
                {Math.round(sets * 10) / 10}
              </div>
              <div className={`volume-readout__status volume-readout__status--${status}`}>
                {STATUS_LABEL[status]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
