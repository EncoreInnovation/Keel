/**
 * Recovery preview — the muscle-recovery map promoted onto Today, condensed.
 *
 * The full body-map screen (two silhouettes, all fifteen muscles) stays
 * reachable behind "See full map" rather than being duplicated wholesale
 * here — showing the three muscles furthest from recovered is the "at a
 * glance" version a dashboard needs; the detailed view is one tap away.
 */

import { useEffect, useState } from 'react';
import { CATALOG } from '../../catalog/exercises';
import { MUSCLES, type MuscleMap } from '../engine/types';
import { recoveryAt } from '../engine/recovery';
import { rebuildFatigue } from '../state/sessionController';
import { getAllSets, getConditioningLogs } from '../storage/repository';
import { colorForRecovery, MUSCLE_LABEL } from './RecoveryMap';

const CATALOG_BY_ID = new Map(CATALOG.map((e) => [e.id, e]));
const LOWEST_COUNT = 3;

export interface RecoveryPreviewProps {
  onOpenRecovery: () => void;
}

export function RecoveryPreview({ onOpenRecovery }: RecoveryPreviewProps) {
  const [recovery, setRecovery] = useState<MuscleMap | undefined>();

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getAllSets(), getConditioningLogs()]).then(([sets, conditioning]) => {
      if (cancelled) return;
      const now = Date.now();
      const fatigue = rebuildFatigue(sets, conditioning, CATALOG_BY_ID, now);
      setRecovery(recoveryAt(fatigue, now));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!recovery) return null;

  const lowest = [...MUSCLES].sort((a, b) => recovery[a] - recovery[b]).slice(0, LOWEST_COUNT);

  return (
    <div className="today__section">
      <div className="today__section-title">Recovery</div>
      <button className="recovery-preview" onClick={onOpenRecovery} aria-label="Open full recovery map">
        {lowest.map((m) => (
          <div key={m} className="recovery-preview__row">
            <span className="recovery-preview__dot" style={{ background: colorForRecovery(recovery[m]) }} />
            <span className="recovery-preview__label">{MUSCLE_LABEL[m]}</span>
            <span className="recovery-preview__pct" data-numeric>
              {Math.round(recovery[m] * 100)}%
            </span>
          </div>
        ))}
        <span className="recovery-preview__link">See full map ›</span>
      </button>
    </div>
  );
}
