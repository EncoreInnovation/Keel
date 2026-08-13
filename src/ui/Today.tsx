/**
 * Today — the home screen.
 *
 * Was a single hero button and nothing else. That fit the original
 * zero-decision, ADHD-first design, but the app pivoted to a physique-first
 * tool where you want information, not just a start button: what's aligned
 * or isn't, what's recovered, what today actually contains. This is now a
 * real dashboard — the alignment strip up top answers "which side is worse"
 * before anything else, because that's the one thing that was buried behind
 * navigation and asked for directly.
 */

import { useEffect, useState } from 'react';
import { PILLAR_KINDS, type Gym, type GymId, type PillarKind, type PrescribedSession } from '../engine/types';
import { PILLAR_SESSIONS } from '../pillars/library';
import { alignmentSummary, type AlignmentSummary } from '../posture/describe';
import { currentStreak, sessionsThisWeek } from '../engine/streak';
import { getCompletedSessions, getPostureLogs } from '../storage/repository';

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
  /** AI readiness commentary, if the coach was reachable — purely supplementary, never blocks rendering. */
  coachNote?: string;
  gyms: Gym[];
  activeGymId: GymId;
  onSwitchGym: (id: GymId) => void;
  onStart: () => void;
  onOpenPillar: (kind: PillarKind) => void;
  onOpenAsymmetry: () => void;
  onOpenRecovery: () => void;
  onOpenProgress: () => void;
  onOpenPosture: () => void;
  onOpenConditioning: () => void;
  onOpenSettings: () => void;
  onOpenAskCoach: () => void;
}

export function Today({
  prescription,
  weeksTotal,
  resumed,
  coachNote,
  gyms,
  activeGymId,
  onSwitchGym,
  onStart,
  onOpenPillar,
  onOpenAsymmetry,
  onOpenRecovery,
  onOpenProgress,
  onOpenPosture,
  onOpenConditioning,
  onOpenSettings,
  onOpenAskCoach,
}: TodayProps) {
  const label = DAY_LABEL[prescription.dayId] ?? prescription.dayName;

  const [alignment, setAlignment] = useState<AlignmentSummary | undefined>();
  const [streak, setStreak] = useState(0);
  const [weekCount, setWeekCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    void getPostureLogs().then((logs) => {
      if (!cancelled) setAlignment(alignmentSummary(logs, now));
    });
    void getCompletedSessions().then((sessions) => {
      if (cancelled) return;
      const dates = sessions.map((s) => s.completedAt ?? s.startedAt);
      setStreak(currentStreak(dates, now));
      setWeekCount(sessionsThisWeek(dates, now));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="today">
      {alignment && (
        <div className={`alignment-strip alignment-strip--${alignment.side}`}>
          <button
            className="alignment-strip__main"
            onClick={onOpenPosture}
            aria-label="Open alignment details"
          >
            <span className="alignment-strip__text">{alignment.headline}</span>
            <span className="alignment-strip__chevron">›</span>
          </button>
          {alignment.side !== 'level' && (
            <button
              className="alignment-strip__action"
              onClick={() => onOpenPillar('realign')}
            >
              Realign routine
            </button>
          )}
        </div>
      )}

      <div className="today__meta">
        Week {prescription.weekNumber} of {weeksTotal}
        {prescription.isDeload ? ' · Deload' : ''}
      </div>
      <h1 className="today__day">{label}</h1>
      <div className="today__estimate" data-numeric>
        {prescription.estimatedMinutes} min
      </div>

      {coachNote && <div className="coach-note">{coachNote}</div>}

      {/* Switching gyms changes what today's session can be built from, so it
          only makes sense before a session exists — once one's active, its
          exercises are already locked in against whichever gym generated it. */}
      {!resumed && gyms.length > 1 && (
        <div className="gym-switch">
          {gyms.map((gym) => (
            <button
              key={gym.id}
              className={`chip${gym.id === activeGymId ? ' chip--active' : ''}`}
              onClick={() => onSwitchGym(gym.id)}
            >
              {gym.name}
            </button>
          ))}
        </div>
      )}

      <button className="btn btn--hero" onClick={onStart}>
        {resumed ? 'Continue' : 'Start'}
      </button>

      {(streak > 0 || weekCount > 0) && (
        <div className="today__streak">
          {streak > 0 && (
            <span className="today__streak-item">
              <span data-numeric>{streak}</span> day streak
            </span>
          )}
          <span className="today__streak-item">
            <span data-numeric>{weekCount}</span> this week
          </span>
        </div>
      )}

      <div className="today__section">
        <div className="today__section-title">Mobility & recovery</div>
        <div className="today__chips">
          {PILLAR_KINDS.map((kind) => (
            <button key={kind} className="chip" onClick={() => onOpenPillar(kind)}>
              {PILLAR_SESSIONS[kind].name}
            </button>
          ))}
        </div>
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
        <button className="btn btn--text" onClick={onOpenConditioning}>
          Log activity
        </button>
        <button className="btn btn--text" onClick={onOpenSettings}>
          Settings
        </button>
        <button className="btn btn--text" onClick={onOpenAskCoach}>
          Ask the coach
        </button>
      </div>
    </div>
  );
}

