/**
 * First-run setup.
 *
 * Kept to the numbers that actually change what the engine computes:
 * bodyweight, and where you're training today. Equipment inventory is seeded
 * from the real known kit (see `config/gyms.ts`) and edited properly in
 * Settings rather than gating day one on a long form.
 *
 * Starting weights are deliberately NOT asked for here — they come from the
 * baseline test, which measures rather than guesses.
 */

import { useState } from 'react';
import { DEFAULT_GYMS } from '../config/gyms';
import type { GymId, UserProfile } from '../engine/types';

export interface SetupProps {
  onComplete: (profile: UserProfile) => void;
}

export function Setup({ onComplete }: SetupProps) {
  const [bodyweight, setBodyweight] = useState(292);
  const [activeGymId, setActiveGymId] = useState<GymId>('home');

  const submit = () => {
    onComplete({
      bodyweight,
      level: 'novice',
      gyms: DEFAULT_GYMS,
      activeGymId,
      flaggedJoints: [],
      impactCeiling: 'low',
      daysPerWeek: 5,
      sessionMinutes: 45,
    });
  };

  return (
    <div className="setup">
      <h1 className="setup__title">KEEL</h1>
      <p className="setup__lede">Two answers, then we find your working weights.</p>

      <label className="setup__field">
        <span>Bodyweight (lb)</span>
        <input
          type="number"
          inputMode="numeric"
          value={bodyweight}
          onChange={(e) => setBodyweight(Number(e.target.value) || 0)}
        />
      </label>

      <div className="setup__field">
        <span>Training today at</span>
        <div className="settings-options">
          {DEFAULT_GYMS.map((gym) => (
            <button
              key={gym.id}
              className={`chip${activeGymId === gym.id ? ' chip--active' : ''}`}
              onClick={() => setActiveGymId(gym.id)}
            >
              {gym.name}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn--hero" onClick={submit}>
        Start
      </button>
    </div>
  );
}
