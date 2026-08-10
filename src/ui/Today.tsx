/**
 * Today — the zero-decision entry point.
 *
 * One hero button, already knowing what today's session is. No browsing, no
 * picking a program, no configuring. Everything else on this screen is
 * secondary to that button.
 */

import type { PrescribedSession } from '../engine/types';

const DAY_LABEL: Record<string, string> = {
  a: 'Lower · Squat',
  b: 'Upper · Push',
  c: 'Lower · Hinge',
  d: 'Upper · Pull',
};

export interface TodayProps {
  prescription: PrescribedSession;
  weeksTotal: number;
  resumed: boolean;
  onStart: () => void;
  onOpenPillar: (kind: 'reset' | 'ground') => void;
}

export function Today({ prescription, weeksTotal, resumed, onStart, onOpenPillar }: TodayProps) {
  const label = DAY_LABEL[prescription.dayId] ?? prescription.dayName;

  return (
    <div className="today">
      <div className="today__meta">
        Week {prescription.weekNumber} of {weeksTotal}
        {prescription.isDeload ? ' · Deload' : ''}
      </div>
      <h1 className="today__day">{label}</h1>
      <div className="today__estimate" data-numeric>
        {prescription.estimatedMinutes} min
      </div>

      <button className="btn btn--hero" onClick={onStart}>
        {resumed ? 'Continue' : 'Start'}
      </button>

      <div className="today__chips">
        <button className="chip" onClick={() => onOpenPillar('reset')}>
          Reset
        </button>
        <button className="chip" onClick={() => onOpenPillar('ground')}>
          Ground
        </button>
      </div>
    </div>
  );
}
