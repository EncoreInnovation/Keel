/**
 * The weekly check-in, in one place. Today's check-in card and the Progress
 * screen used to carry their own copies, which had already drifted — one of
 * them opened a keypad with no decimal point, so 284.3 couldn't be typed.
 *
 * The smart-scale fields are optional: weight and waist are the check-in,
 * body fat and visceral fat come along when there's a scale reading to copy.
 */

import { useState } from 'react';
import type { BodyMetricLog } from '../engine/types';

/** Ranges outside which a number is a typo, not a reading. */
const RANGES = {
  weight: [80, 600],
  waist: [20, 80],
  bodyFat: [3, 60],
  visceral: [1, 59],
} as const;

function read(raw: string, [min, max]: readonly [number, number]): number | undefined {
  const n = Number(raw.trim().replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

export interface WeighInFormProps {
  onSave: (entry: BodyMetricLog) => Promise<void> | void;
}

export function WeighInForm({ onSave }: WeighInFormProps) {
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [visceral, setVisceral] = useState('');
  const [busy, setBusy] = useState(false);

  const values = {
    weight: read(weight, RANGES.weight),
    waist: read(waist, RANGES.waist),
    bodyFatPct: read(bodyFat, RANGES.bodyFat),
    visceralFat: read(visceral, RANGES.visceral),
  };
  const anything = Object.values(values).some((v) => v !== undefined);

  const save = async () => {
    if (!anything || busy) return;
    setBusy(true);
    const now = Date.now();
    await onSave({
      id: `bm-${now}`,
      at: now,
      weight: values.weight,
      measurements: values.waist !== undefined ? { waist: values.waist } : undefined,
      bodyFatPct: values.bodyFatPct,
      visceralFat: values.visceralFat,
    });
    setWeight('');
    setWaist('');
    setBodyFat('');
    setVisceral('');
    setBusy(false);
  };

  const field = (label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <label className="weigh-in__field">
      <span className="weigh-in__label">{label}</span>
      <input type="text" inputMode="decimal" placeholder={placeholder} value={value} onChange={(e) => set(e.target.value)} aria-label={label} />
    </label>
  );

  return (
    <div className="weigh-in">
      <div className="weigh-in__row">
        {field('Weight (lb)', weight, setWeight, 'e.g. 284.3')}
        {field('Waist (in)', waist, setWaist, 'at the navel')}
      </div>
      <div className="weigh-in__group">From your smart scale (optional)</div>
      <div className="weigh-in__row">
        {field('Body fat %', bodyFat, setBodyFat, 'e.g. 22.0')}
        {field('Visceral fat', visceral, setVisceral, 'e.g. 17')}
      </div>
      <button className="btn btn--ghost weigh-in__save" onClick={() => void save()} disabled={!anything || busy}>
        Save check-in
      </button>
    </div>
  );
}
