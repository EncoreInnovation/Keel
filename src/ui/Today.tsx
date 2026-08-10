/**
 * Today — the zero-decision entry point.
 *
 * One hero button, already knowing what today's session is. No browsing, no
 * picking a program, no configuring. Everything else on this screen is
 * secondary to that button.
 */

import { PILLAR_KINDS, type PillarKind, type PrescribedSession } from '../engine/types';
import { PILLAR_SESSIONS } from '../pillars/library';

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
  onOpenPillar: (kind: PillarKind) => void;
  onOpenAsymmetry: () => void;
  onOpenRecovery: () => void;
  onOpenProgress: () => void;
  onOpenPosture: () => void;
}

export function Today({
  prescription,
  weeksTotal,
  resumed,
  onStart,
  onOpenPillar,
  onOpenAsymmetry,
  onOpenRecovery,
  onOpenProgress,
  onOpenPosture,
}: TodayProps) {
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
        {PILLAR_KINDS.map((kind) => (
          <button key={kind} className="chip" onClick={() => onOpenPillar(kind)}>
            {PILLAR_SESSIONS[kind].name}
          </button>
        ))}
      </div>

      <div className="today__links">
        <button className="btn btn--text" onClick={onOpenRecovery}>
          Recovery
        </button>
        <button className="btn btn--text" onClick={onOpenProgress}>
          Progress
        </button>
        <button className="btn btn--text" onClick={onOpenAsymmetry}>
          Left / right balance
        </button>
        <button className="btn btn--text" onClick={onOpenPosture}>
          Posture
        </button>
      </div>
    </div>
  );
}
