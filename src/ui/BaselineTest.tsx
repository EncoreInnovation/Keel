/**
 * The baseline test — measuring instead of guessing.
 *
 * Runs once, after setup. For each main lift you do one honest set and enter
 * what happened; for the bodyweight ladders you enter a max-rep number. From
 * that the engine derives a real starting load for every loadable movement
 * and drops you onto the right ladder rung, replacing v1's "start at zero and
 * creep upward" behaviour that opened the goblet squat at 5 lb.
 *
 * The sets you log here are written as ordinary SetLogs, not into some
 * parallel baseline store. That keeps one source of truth: the progression
 * engine reads them exactly the way it reads any other session.
 */

import { useState } from 'react';
import { CATALOG } from '../../catalog/exercises';
import { ladderChain, startingRungFrom } from '../engine/baseline';
import { achievableLoads } from '../engine/loading';
import { buildLadderIndex } from '../engine/ladders';
import { activeGym } from '../engine/types';
import { appendSets, saveProfile } from '../storage/repository';
import { RPE_HINTS } from './rpe';
import type { Exercise, SetLog, UserProfile } from '../engine/types';

const catalog = CATALOG as Exercise[];
const byId = new Map(catalog.map((e) => [e.id, e]));
const ladderIndex = buildLadderIndex(catalog);

/** The lifts worth testing: one per major pattern, all loadable. */
const LOADED_TESTS = ['goblet-squat', 'rdl-db', 'floor-press-db', 'bent-row-db'] as const;

/** Bodyweight ladders where a max-rep test decides the starting rung. */
const BODYWEIGHT_TESTS = ['pushup', 'band-lat-pulldown'] as const;

interface LoadedEntry {
  weight: string;
  reps: string;
  rpe: number;
}

export interface BaselineTestProps {
  profile: UserProfile;
  onComplete: (profile: UserProfile) => void;
  onSkip: () => void;
}

export function BaselineTest({ profile, onComplete, onSkip }: BaselineTestProps) {
  const gym = activeGym(profile);

  const [loaded, setLoaded] = useState<Record<string, LoadedEntry>>(() =>
    Object.fromEntries(LOADED_TESTS.map((id) => [id, { weight: '', reps: '', rpe: 8 }])),
  );
  const [bodyweight, setBodyweight] = useState<Record<string, string>>(() =>
    Object.fromEntries(BODYWEIGHT_TESTS.map((id) => [id, ''])),
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const at = Date.now();
    const sets: SetLog[] = [];

    // Loadable lifts: log the test set verbatim. `nextPrescription` will read
    // it as the last attempt and compute the next session from it.
    for (const [exerciseId, entry] of Object.entries(loaded)) {
      const weight = Number(entry.weight);
      const reps = Number(entry.reps);
      if (!weight || !reps) continue;
      sets.push({
        id: `baseline-${exerciseId}-${at}`,
        sessionId: `baseline-${at}`,
        exerciseId,
        setIndex: 0,
        side: 'both',
        weight,
        reps,
        rpe: entry.rpe,
        completedAt: at,
      });
    }

    // Bodyweight ladders: the rep count picks the rung rather than the load.
    const baselineRungs: string[] = [];
    for (const [exerciseId, raw] of Object.entries(bodyweight)) {
      const maxReps = Number(raw);
      if (!maxReps) continue;
      const start = byId.get(exerciseId);
      if (!start) continue;
      const chain = ladderChain(start, ladderIndex, byId);
      const rung = startingRungFrom(start, maxReps, chain);
      if (rung) baselineRungs.push(rung.id);
    }

    if (sets.length > 0) await appendSets(sets);

    const updated: UserProfile = {
      ...profile,
      baselineRungs,
      baselineCompletedAt: at,
    };
    await saveProfile(updated);
    onComplete(updated);
  };

  return (
    <div className="phase-screen baseline">
      <div className="phase-screen__eyebrow">Baseline</div>
      <p className="placeholder__body">
        One hard set each — stop with a rep or two left, not at failure. This is what stops the app
        guessing your weights.
      </p>

      {LOADED_TESTS.map((id) => {
        const exercise = byId.get(id);
        if (!exercise) return null;
        const loads = achievableLoads(exercise, gym);
        const entry = loaded[id]!;

        return (
          <section key={id} className="baseline-test">
            <h2 className="progress-section__title">{exercise.name}</h2>
            {loads.length > 0 && (
              <p className="settings-section__hint">
                Available at {gym.name}: {loads.join(', ')} lb
              </p>
            )}
            <div className="baseline-test__row">
              <label className="baseline-field">
                <span>Weight</span>
                <input
                  type="number"
                  inputMode="numeric"
                  className="settings-input"
                  value={entry.weight}
                  onChange={(e) =>
                    setLoaded({ ...loaded, [id]: { ...entry, weight: e.target.value } })
                  }
                />
              </label>
              <label className="baseline-field">
                <span>Reps</span>
                <input
                  type="number"
                  inputMode="numeric"
                  className="settings-input"
                  value={entry.reps}
                  onChange={(e) =>
                    setLoaded({ ...loaded, [id]: { ...entry, reps: e.target.value } })
                  }
                />
              </label>
            </div>
            <div className="baseline-test__row">
              {[7, 8, 9, 10].map((value) => (
                <button
                  key={value}
                  className={`chip${entry.rpe === value ? ' chip--active' : ''}`}
                  onClick={() => setLoaded({ ...loaded, [id]: { ...entry, rpe: value } })}
                >
                  {RPE_HINTS[value] ?? value}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {BODYWEIGHT_TESTS.map((id) => {
        const exercise = byId.get(id);
        if (!exercise) return null;
        return (
          <section key={id} className="baseline-test">
            <h2 className="progress-section__title">{exercise.name} — max reps</h2>
            <p className="settings-section__hint">
              As many clean reps as you can. This decides which variation you start on.
            </p>
            <input
              type="number"
              inputMode="numeric"
              className="settings-input"
              value={bodyweight[id]}
              onChange={(e) => setBodyweight({ ...bodyweight, [id]: e.target.value })}
            />
          </section>
        );
      })}

      <button className="btn btn--hero" disabled={saving} onClick={() => void handleSave()}>
        {saving ? 'Saving…' : 'Save baseline'}
      </button>
      <button className="btn btn--ghost" onClick={onSkip}>
        Skip for now
      </button>
    </div>
  );
}
