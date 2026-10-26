/**
 * Logging a Dig Deeper workout. Everything past "done" is optional — the
 * date, minutes and effort are what the schedule and recovery need; the
 * weight rows are for you.
 *
 * Rows start filled from the last time you did this same workout, with last
 * time's numbers as placeholders, so a repeat only needs the numbers that
 * changed. Marking a one-sided exercise left or right feeds Left/right
 * balance.
 */

import { useMemo, useState } from 'react';
import { DD_BY_ID, ymd, type DDExerciseRow, type DDLog, type DDSlot } from '../programs/digDeeper';
import type { WorkoutLogInput } from '../state/program';

interface RowDraft {
  exercise: string;
  weight: string;
  reps: string;
  sets: string;
  side: NonNullable<DDExerciseRow['side']>;
  prev?: DDExerciseRow;
}

const toNum = (s: string) => {
  const n = Number(s.trim().replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : undefined;
};

export interface DigDeeperLogProps {
  slot: DDSlot;
  mode: 'completed' | 'substitute';
  performedWorkoutId: string;
  logs: DDLog[];
  initialMinutes?: number;
  onSave: (input: WorkoutLogInput) => Promise<void>;
  onCancel: () => void;
}

export function DigDeeperLog({ slot, mode, performedWorkoutId, logs, initialMinutes, onSave, onCancel }: DigDeeperLogProps) {
  const performed = DD_BY_ID.get(performedWorkoutId)!;
  const scheduled = DD_BY_ID.get(slot.workoutId)!;
  const last = useMemo(
    () =>
      [...logs]
        .filter((l) => l.performedWorkoutId === performedWorkoutId && l.rows?.some((r) => r.exercise))
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
        .at(-1),
    [logs, performedWorkoutId],
  );
  const knownExercises = useMemo(
    () => [...new Set(logs.flatMap((l) => l.rows?.map((r) => r.exercise.trim()) ?? []).filter(Boolean))].sort(),
    [logs],
  );

  const today = ymd(new Date());
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState(String(initialMinutes ?? performed.minutes));
  const [effort, setEffort] = useState('7');
  const [rows, setRows] = useState<RowDraft[]>(() =>
    last?.rows?.length
      ? last.rows.map((r) => ({ exercise: r.exercise, weight: '', reps: '', sets: '', side: r.side ?? 'both', prev: r }))
      : [{ exercise: '', weight: '', reps: '', sets: '', side: 'both' }],
  );
  const [pain, setPain] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (i: number, patch: Partial<RowDraft>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const cleaned: DDExerciseRow[] = rows
      .filter((r) => r.exercise.trim())
      .map((r) => ({
        exercise: r.exercise.trim(),
        // A row left blank keeps last time's numbers — you did the same again.
        weight: toNum(r.weight) ?? r.prev?.weight,
        reps: toNum(r.reps) ?? r.prev?.reps,
        sets: toNum(r.sets) ?? r.prev?.sets,
        side: r.side,
      }));
    await onSave({
      type: mode,
      date,
      slotId: slot.id,
      scheduledWorkoutId: slot.workoutId,
      performedWorkoutId,
      durationMin: toNum(minutes),
      effort: toNum(effort),
      rows: cleaned.length ? cleaned : undefined,
      painNotes: pain.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="phase-screen dd-log">
      <div className="phase-screen__eyebrow">
        Week {slot.week} · Day {slot.day}
      </div>
      <h1 className="dd-card__title">{performed.title}</h1>
      {mode === 'substitute' && <p className="placeholder__body">In place of {scheduled.title} — counts as today's workout.</p>}

      <div className="weigh-in__row dd-log__basics">
        <label className="weigh-in__field">
          <span className="weigh-in__label">Date</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
        </label>
        <label className="weigh-in__field">
          <span className="weigh-in__label">Minutes</span>
          <input type="text" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
      </div>
      <label className="weigh-in__field dd-log__effort">
        <span className="weigh-in__label">Effort (1–10)</span>
        <select className="settings-input" value={effort} onChange={(e) => setEffort(e.target.value)}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <section className="dd-log__rows">
        <h2 className="dd-finishers__title">Weights (optional)</h2>
        {last && (
          <p className="dd-card__note">
            From your last {performed.title} on {last.date}. Grey numbers are what you did then — type only what changed.
          </p>
        )}
        <datalist id="dd-exercises">
          {knownExercises.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        {rows.map((r, i) => (
          <div key={i} className="dd-row">
            <input
              className="dd-row__name"
              list="dd-exercises"
              placeholder="Exercise, e.g. Lateral raise"
              aria-label="Exercise"
              value={r.exercise}
              onChange={(e) => update(i, { exercise: e.target.value })}
            />
            <div className="dd-row__nums">
              <input inputMode="decimal" aria-label="Pounds" placeholder={r.prev?.weight !== undefined ? `${r.prev.weight} lb` : 'lb'} value={r.weight} onChange={(e) => update(i, { weight: e.target.value })} />
              <input inputMode="numeric" aria-label="Reps" placeholder={r.prev?.reps !== undefined ? `${r.prev.reps} reps` : 'reps'} value={r.reps} onChange={(e) => update(i, { reps: e.target.value })} />
              <input inputMode="numeric" aria-label="Sets" placeholder={r.prev?.sets !== undefined ? `${r.prev.sets} sets` : 'sets'} value={r.sets} onChange={(e) => update(i, { sets: e.target.value })} />
              <select aria-label="Side" value={r.side} onChange={(e) => update(i, { side: e.target.value as RowDraft['side'] })}>
                <option value="both">Both</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
              <button className="btn btn--text dd-row__remove" aria-label="Remove row" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          </div>
        ))}
        <button className="btn btn--text" onClick={() => setRows((rs) => [...rs, { exercise: '', weight: '', reps: '', sets: '', side: 'both' }])}>
          + Add exercise
        </button>
        <p className="dd-card__note">One-sided move? Log each side as its own row — Left/right balance compares them.</p>
      </section>

      <label className="weigh-in__field dd-log__wide">
        <span className="weigh-in__label">Pain or discomfort</span>
        <textarea className="settings-input" placeholder="Where, which move, how bad. Blank if none." value={pain} onChange={(e) => setPain(e.target.value)} />
      </label>
      <label className="weigh-in__field dd-log__wide">
        <span className="weigh-in__label">Notes</span>
        <textarea className="settings-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <button className="btn btn--hero" onClick={() => void save()} disabled={busy}>
        Save log
      </button>
      <button className="btn btn--text" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
