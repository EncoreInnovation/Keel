/**
 * Settings — the profile fields that are meant to change after setup.
 *
 * Notably absent: bodyweight and schedule. Bodyweight isn't duplicated here
 * because the Progress screen already owns weight as a tracked trend
 * (BodyMetricLog) — a second editable copy of the same concept would create
 * exactly the two-sources-of-truth problem this app has avoided everywhere
 * else. Schedule (4 days/week, 30-45 min) is a locked program decision from
 * the plan, not a preference, so it's shown read-only rather than editable.
 */

import { useState } from 'react';
import { EQUIPMENT, JOINTS } from '../engine/types';
import { IMPACT_ORDER } from '../engine/recovery';
import { saveProfile } from '../storage/repository';
import type { Equipment, ExperienceLevel, ImpactLevel, Joint, UserProfile } from '../engine/types';

const EQUIPMENT_LABEL: Record<Equipment, string> = {
  bodyweight: 'Bodyweight / floor',
  dumbbell: 'Dumbbells',
  kettlebell: 'Kettlebell',
  band: 'Resistance bands',
  suspension: 'Suspension trainer',
  pullupBar: 'Pull-up bar',
  bench: 'Bench',
  mat: 'Mat',
  wall: 'Wall space',
  chair: 'Chair',
};

const JOINT_LABEL: Record<Joint, string> = {
  knee: 'Knee',
  hip: 'Hip',
  lowBack: 'Low back',
  shoulder: 'Shoulder',
  elbow: 'Elbow',
  wrist: 'Wrist',
  ankle: 'Ankle',
  neck: 'Neck',
};

const LEVELS: ExperienceLevel[] = ['novice', 'intermediate', 'advanced'];

export interface SettingsProps {
  profile: UserProfile;
  onSaved: (profile: UserProfile) => void;
  onBack: () => void;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function Settings({ profile, onSaved, onBack }: SettingsProps) {
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await saveProfile(draft);
    onSaved(draft);
    setSaved(true);
  };

  return (
    <div className="phase-screen settings">
      <div className="phase-screen__eyebrow">Settings</div>

      <section className="settings-section">
        <h2 className="settings-section__title">Experience level</h2>
        <div className="settings-options">
          {LEVELS.map((level) => (
            <button
              key={level}
              className={`chip${draft.level === level ? ' chip--active' : ''}`}
              onClick={() => setDraft({ ...draft, level })}
            >
              {level}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Equipment</h2>
        <div className="settings-options">
          {EQUIPMENT.map((eq) => (
            <button
              key={eq}
              className={`chip${draft.availableEquipment.includes(eq) ? ' chip--active' : ''}`}
              onClick={() => setDraft({ ...draft, availableEquipment: toggle(draft.availableEquipment, eq) })}
            >
              {EQUIPMENT_LABEL[eq]}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Dumbbell jump size (lb)</h2>
        <input
          type="number"
          inputMode="numeric"
          className="settings-input"
          value={draft.dumbbellIncrement}
          onChange={(e) => setDraft({ ...draft, dumbbellIncrement: Number(e.target.value) || 5 })}
        />
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Flagged joints</h2>
        <p className="settings-section__hint">
          Movements loading a flagged joint drop out of rotation until you clear it here.
        </p>
        <div className="settings-options">
          {JOINTS.map((joint) => (
            <button
              key={joint}
              className={`chip${draft.flaggedJoints.includes(joint) ? ' chip--active chip--warn' : ''}`}
              onClick={() => setDraft({ ...draft, flaggedJoints: toggle(draft.flaggedJoints, joint) })}
            >
              {JOINT_LABEL[joint]}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Impact ceiling</h2>
        <p className="settings-section__hint">
          A hard cap on top of what the engine has earned through joint-load history — never higher,
          only ever a further limit.
        </p>
        <div className="settings-options">
          {IMPACT_ORDER.map((level: ImpactLevel) => (
            <button
              key={level}
              className={`chip${draft.impactCeiling === level ? ' chip--active' : ''}`}
              onClick={() => setDraft({ ...draft, impactCeiling: level })}
            >
              {level}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section settings-section--locked">
        <h2 className="settings-section__title">Program schedule</h2>
        <p className="settings-section__hint">
          {draft.daysPerWeek} days/week, {draft.sessionMinutes} min sessions — fixed for the Cruise
          Block.
        </p>
      </section>

      <button className="btn btn--hero" onClick={() => void handleSave()}>
        {saved ? 'Saved' : 'Save'}
      </button>
      <button className="btn btn--ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
