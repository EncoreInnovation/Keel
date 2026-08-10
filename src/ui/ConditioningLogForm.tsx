/**
 * Manual conditioning log — runs, walks, circuits, anything Strava doesn't
 * see yet. Feeds the exact same `applyConditioning` fatigue model as a
 * synced Strava activity would, so a Lake Johnson run logged by hand
 * already lowers tomorrow's prescribed leg volume, not just a future
 * integration's version of it.
 */

import { useState } from 'react';
import { appendConditioningLog } from '../storage/repository';
import { IMPACT_ORDER } from '../engine/recovery';
import type { ConditioningKind, ImpactLevel } from '../engine/types';

const KIND_OPTIONS: ConditioningKind[] = ['run', 'walk', 'bike', 'circuit', 'hiit', 'other'];
const KIND_LABEL: Record<ConditioningKind, string> = {
  run: 'Run',
  walk: 'Walk',
  bike: 'Bike',
  circuit: 'Circuit',
  hiit: 'HIIT',
  other: 'Other',
};

export interface ConditioningLogFormProps {
  onSaved: () => void;
  onCancel: () => void;
}

export function ConditioningLogForm({ onSaved, onCancel }: ConditioningLogFormProps) {
  const [kind, setKind] = useState<ConditioningKind>('run');
  const [minutes, setMinutes] = useState(30);
  const [effort, setEffort] = useState(6);
  const [impact, setImpact] = useState<ImpactLevel>('moderate');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const durationSec = minutes * 60;
    await appendConditioningLog({
      id: `cond-${Date.now()}`,
      kind,
      startedAt: Date.now() - durationSec * 1000,
      durationSec,
      effort,
      impact,
      source: 'manual',
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="phase-screen conditioning-log">
      <div className="phase-screen__eyebrow">Log activity</div>

      <section className="settings-section">
        <h2 className="settings-section__title">Type</h2>
        <div className="settings-options">
          {KIND_OPTIONS.map((k) => (
            <button
              key={k}
              className={`chip${kind === k ? ' chip--active' : ''}`}
              onClick={() => setKind(k)}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Duration (minutes)</h2>
        <div className="stepper">
          <button className="stepper__btn" onClick={() => setMinutes((m) => Math.max(5, m - 5))}>
            −
          </button>
          <div className="stepper__value" data-numeric>
            {minutes}
            <span className="stepper__label">min</span>
          </div>
          <button className="stepper__btn" onClick={() => setMinutes((m) => m + 5)}>
            +
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Effort (1–10)</h2>
        <div className="settings-options">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((e) => (
            <button
              key={e}
              className={`chip${effort === e ? ' chip--active' : ''}`}
              onClick={() => setEffort(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Impact</h2>
        <div className="settings-options">
          {IMPACT_ORDER.map((level) => (
            <button
              key={level}
              className={`chip${impact === level ? ' chip--active' : ''}`}
              onClick={() => setImpact(level)}
            >
              {level}
            </button>
          ))}
        </div>
      </section>

      <button className="btn btn--hero" disabled={saving} onClick={() => void handleSave()}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button className="btn btn--ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
