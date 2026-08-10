/**
 * First-run setup — deliberately short. The only two numbers that actually
 * change what the engine computes are bodyweight (RPE/exertion context) and
 * the dumbbell increment (every load prescription rounds to it). Equipment
 * and joint flags default to the full Cruise Block kit and get a proper
 * editor in the Settings screen (Milestone 3) rather than gating day one on
 * a long form.
 */

import { useState } from 'react';
import type { Equipment, UserProfile } from '../engine/types';

const DEFAULT_EQUIPMENT: Equipment[] = [
  'bodyweight',
  'dumbbell',
  'kettlebell',
  'band',
  'suspension',
  'pullupBar',
  'bench',
  'mat',
  'wall',
  'chair',
];

export interface SetupProps {
  onComplete: (profile: UserProfile) => void;
}

export function Setup({ onComplete }: SetupProps) {
  const [bodyweight, setBodyweight] = useState(292);
  const [dumbbellIncrement, setDumbbellIncrement] = useState(5);

  const submit = () => {
    const profile: UserProfile = {
      bodyweight,
      level: 'novice',
      availableEquipment: DEFAULT_EQUIPMENT,
      dumbbellIncrement,
      flaggedJoints: [],
      impactCeiling: 'low',
      daysPerWeek: 4,
      sessionMinutes: 40,
    };
    onComplete(profile);
  };

  return (
    <div className="setup">
      <h1 className="setup__title">KEEL</h1>
      <p className="setup__lede">Two numbers, then you're training.</p>

      <label className="setup__field">
        <span>Bodyweight (lb)</span>
        <input
          type="number"
          inputMode="numeric"
          value={bodyweight}
          onChange={(e) => setBodyweight(Number(e.target.value) || 0)}
        />
      </label>

      <label className="setup__field">
        <span>Dumbbell jump size (lb)</span>
        <input
          type="number"
          inputMode="numeric"
          value={dumbbellIncrement}
          onChange={(e) => setDumbbellIncrement(Number(e.target.value) || 5)}
        />
      </label>

      <button className="btn btn--hero" onClick={submit}>
        Start
      </button>
    </div>
  );
}
