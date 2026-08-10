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
  barbell: 'Barbell',
  ezBar: 'EZ curl bar',
  kettlebell: 'Kettlebell',
  band: 'Resistance bands',
  suspension: 'Suspension trainer',
  pullupBar: 'Pull-up bar',
  bench: 'Bench',
  cable: 'Cable machine',
  legPress: 'Leg press',
  medicineBall: 'Medicine ball',
  battleRopes: 'Battle ropes',
  abRoller: 'Ab roller',
  punchingBag: 'Punching bag',
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

/** "10, 20, 30" -> [10, 20, 30]. Tolerates trailing commas and stray spaces. */
function parseWeightList(raw: string): number[] {
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
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

      {draft.gyms.map((gym, gymIndex) => {
        const updateGym = (patch: Partial<typeof gym>) =>
          setDraft({
            ...draft,
            gyms: draft.gyms.map((g, i) => (i === gymIndex ? { ...g, ...patch } : g)),
          });

        return (
          <section key={gym.id} className="settings-section">
            <h2 className="settings-section__title">{gym.name} — equipment</h2>
            <div className="settings-options">
              {EQUIPMENT.map((eq) => (
                <button
                  key={eq}
                  className={`chip${gym.equipment.includes(eq) ? ' chip--active' : ''}`}
                  onClick={() => updateGym({ equipment: toggle(gym.equipment, eq) })}
                >
                  {EQUIPMENT_LABEL[eq]}
                </button>
              ))}
            </div>

            <h3 className="settings-section__title">Dumbbells you own (lb)</h3>
            <p className="settings-section__hint">
              The actual weights, comma separated — not a jump size. Fixed dumbbells don't
              increment, so the engine needs the real list to avoid prescribing a weight you
              can't pick up.
            </p>
            <input
              type="text"
              inputMode="numeric"
              className="settings-input"
              value={gym.dumbbells.join(', ')}
              onChange={(e) => updateGym({ dumbbells: parseWeightList(e.target.value) })}
            />

            <h3 className="settings-section__title">Kettlebells (lb)</h3>
            <input
              type="text"
              inputMode="numeric"
              className="settings-input"
              value={gym.kettlebells.join(', ')}
              onChange={(e) => updateGym({ kettlebells: parseWeightList(e.target.value) })}
            />

            {gym.barbell && (
              <>
                <h3 className="settings-section__title">Barbell plates</h3>
                <p className="settings-section__hint">
                  Pairs of each plate — 2×25 lb plates is one pair. Bar is {gym.barbell.barWeight} lb.
                </p>
                <div className="settings-plates">
                  {gym.barbell.plates.map((denom, i) => (
                    <label key={denom} className="settings-plate">
                      <span>{denom} lb</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="settings-input"
                        value={gym.barbell!.pairsPerPlate[i] ?? 0}
                        onChange={(e) =>
                          updateGym({
                            barbell: {
                              ...gym.barbell!,
                              pairsPerPlate: gym.barbell!.pairsPerPlate.map((p, j) =>
                                j === i ? Math.max(0, Number(e.target.value) || 0) : p,
                              ),
                            },
                          })
                        }
                      />
                      <span className="settings-plate__unit">pairs</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </section>
        );
      })}

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
