/**
 * The private monthly check-in: five one-tap questions, then a save. Lives
 * behind the Progress tab rather than on Today, so it never sits on the
 * home screen.
 */

import { useState } from 'react';
import { controlScore, erectionScore, INTIMACY_QUESTIONS, SCALE_LABELS, type IntimacyLog } from '../engine/intimacy';
import { appendIntimacyLog } from '../storage/repository';

export interface IntimacyCheckinProps {
  onSaved: () => void;
  onCancel: () => void;
}

export function IntimacyCheckin({ onSaved, onCancel }: IntimacyCheckinProps) {
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const index = answers.length;
  const question = INTIMACY_QUESTIONS[index];

  const answer = (value: number | null) => setAnswers((a) => [...a, value]);

  if (question) {
    return (
      <div className="phase-screen intimacy">
        <div className="phase-screen__eyebrow">
          Private check-in · {index + 1} of {INTIMACY_QUESTIONS.length}
        </div>
        <p className="intimacy__question">{question.text}</p>
        <div className="activation-rating">
          {SCALE_LABELS[question.scale].map((label, i) => (
            <button key={label} className="activation-rating__opt" onClick={() => answer(i + 1)}>
              <span className="activation-rating__num" data-numeric>
                {i + 1}
              </span>
              <span className="activation-rating__label">{label}</span>
            </button>
          ))}
        </div>
        {question.skippable && (
          <button className="btn btn--text" onClick={() => answer(null)}>
            Didn’t have sex this month
          </button>
        )}
        <div className="checkin-card__row intimacy__nav">
          {index > 0 && (
            <button className="btn btn--text" onClick={() => setAnswers((a) => a.slice(0, -1))}>
              Back a question
            </button>
          )}
          <button className="btn btn--text" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <p className="intimacy__privacy">Stored only on this phone. Never sent to the coach or anywhere else.</p>
      </div>
    );
  }

  const draft: IntimacyLog = { id: `int-${Date.now()}`, at: Date.now(), answers };
  const erection = erectionScore(draft);
  const control = controlScore(draft);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    await appendIntimacyLog(draft);
    onSaved();
  };

  return (
    <div className="phase-screen intimacy">
      <div className="phase-screen__eyebrow">Private check-in</div>
      <div className="intimacy__scores">
        <div className="intimacy__score">
          <span className="intimacy__score-value" data-numeric>
            {erection ?? '—'}
          </span>
          <span className="intimacy__score-label">Erections, out of 20</span>
        </div>
        <div className="intimacy__score">
          <span className="intimacy__score-value" data-numeric>
            {control ?? '—'}
          </span>
          <span className="intimacy__score-label">Control, out of 5</span>
        </div>
      </div>
      <p className="placeholder__body">
        Your own trend is what counts — compare month to month. Blood flow, the pelvic floor and fat loss all take 8–12
        weeks to show up here.
      </p>
      <button className="btn btn--hero" onClick={() => void save()} disabled={busy}>
        Save
      </button>
      <button className="btn btn--text" onClick={onCancel}>
        Don’t save
      </button>
    </div>
  );
}
