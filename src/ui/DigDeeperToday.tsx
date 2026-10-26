/**
 * Today, while Dig Deeper is the lifting program: today's workout from the
 * 12-week calendar, the short-on-time swap BODi itself recommends, what's
 * coming next, and the finishers to add after the workout.
 *
 * The videos live in the BODi app (and on the DIG DEEPER Central page) — this
 * card says what to do and records that you did it.
 */

import { useEffect, useState } from 'react';
import type { Gym, Muscle } from '../engine/types';
import {
  BODI_URL,
  COLLECTIONS,
  DD_BY_ID,
  DD_CENTRAL_URL,
  noExcusesFor,
  parseYmd,
  ymd,
  type DDSlot,
} from '../programs/digDeeper';
import { ropeSession, saunaSession, stairSession, totalSeconds } from '../programs/finishers';
import { finisherPicks, type FinisherPick, type ProgramState } from '../state/program';
import { MUSCLE_LABEL } from './RecoveryMap';

const TIMER_KEY = 'colossus.ddTimer';

function readTimer(): { slotId: string; startedAt: number } | undefined {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function writeTimer(value: { slotId: string; startedAt: number } | undefined) {
  try {
    if (value) localStorage.setItem(TIMER_KEY, JSON.stringify(value));
    else localStorage.removeItem(TIMER_KEY);
  } catch {
    // Private mode: the timer just won't survive closing the app.
  }
}

/** Minutes on the running timer for a slot, if one is running. */
export function timerMinutes(slotId: string, now: number): number | undefined {
  const t = readTimer();
  return t && t.slotId === slotId ? Math.max(1, Math.round((now - t.startedAt) / 60_000)) : undefined;
}

export function clearTimer() {
  writeTimer(undefined);
}

const day = (s: string) => parseYmd(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function focus(workoutId: string): string {
  const muscles = DD_BY_ID.get(workoutId)?.muscles ?? {};
  return (Object.entries(muscles) as [Muscle, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => MUSCLE_LABEL[m])
    .join(' · ');
}

export interface DigDeeperTodayProps {
  program: ProgramState;
  readiness?: number;
  gym: Gym;
  /** Stair-climber base level, so the cards show the levels you'll actually use. */
  stairBase?: number;
  onOpenRoadmap: () => void;
  onLog: (mode: 'completed' | 'substitute', slot: DDSlot, performedWorkoutId: string) => void;
  onSkip: (slot: DDSlot) => void;
  onRestDay: () => void;
  onFinisher: (pick: FinisherPick, replacesSlot?: DDSlot) => void;
}

export function DigDeeperToday({ program, readiness, gym, stairBase, onOpenRoadmap, onLog, onSkip, onRestDay, onFinisher }: DigDeeperTodayProps) {
  const { plan } = program;
  const [trainAnyway, setTrainAnyway] = useState(false);
  const [showShort, setShowShort] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [timer, setTimer] = useState(readTimer);
  const [now, setNow] = useState(() => Date.now());
  const [picks, setPicks] = useState<FinisherPick[]>([]);

  const slot = plan.today ?? (trainAnyway && !plan.loggedToday.length ? plan.next : undefined);
  const workout = slot ? DD_BY_ID.get(slot.workoutId) : undefined;
  const timerRunning = Boolean(slot && timer && timer.slotId === slot.id);
  const shorts = slot ? noExcusesFor(slot.workoutId).slice(0, 2) : [];
  const isCardioDay = workout?.kind === 'cardio';
  const beforeStart = !slot && program.settings.startDate > ymd(new Date(now));

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    void finisherPicks(gym, Date.now()).then(setPicks);
  }, [gym, plan.loggedToday.length]);

  const startTimer = () => {
    if (!slot) return;
    const t = { slotId: slot.id, startedAt: Date.now() };
    writeTimer(t);
    setTimer(t);
    setNow(t.startedAt);
  };

  const collection = COLLECTIONS[slot ? DD_BY_ID.get(slot.workoutId)!.collection : plan.next ? DD_BY_ID.get(plan.next.workoutId)!.collection : 'tb'];
  const upcoming = plan.projection.filter((p) => !slot || p.slot.id !== slot.id).slice(0, 3);
  const stairs = picks.find((p) => p.kind === 'stairs');

  return (
    <div className="dd">
      <button className="today__meta today__meta--link" onClick={onOpenRoadmap} aria-label="Open the Q4 roadmap">
        Dig Deeper week {plan.week} of 12 · {collection.name} · Q4 plan ›
      </button>

      {plan.daysBehind > 0 && (
        <p className="dd__behind">
          {plan.daysBehind} {plan.daysBehind === 1 ? 'day' : 'days'} behind the official finish — missed days push the plan back, nothing doubles up.
          Projected finish {plan.projectedFinish ? day(plan.projectedFinish) : '—'}.
        </p>
      )}

      {slot && workout && (
        <section className={`dd-card dd-card--${workout.collection}`}>
          <div className="dd-card__eyebrow">
            Week {slot.week} · Day {slot.day} · {COLLECTIONS[workout.collection].name}
            {plan.today ? '' : ' · extra day'}
          </div>
          <h1 className="dd-card__title">{workout.title}</h1>
          <div className="dd-card__meta">
            About {workout.minutes} min · {focus(workout.id)}
          </div>
          {slot.optional && (
            <p className="dd-card__note">Optional on the official calendar. Skip it, take a brisk walk, or do stairs instead.</p>
          )}
          {readiness !== undefined && readiness <= 2 && isCardioDay && (
            <p className="dd-card__note dd-card__note--warn">
              Low energy today. An easy 20-minute walk is plenty — or skip it; this one's optional.
            </p>
          )}
          {readiness !== undefined && readiness <= 2 && shorts[0] && (
            <p className="dd-card__note dd-card__note--warn">
              Low energy today. {shorts[0].title} (about {shorts[0].minutes} min) counts as today's workout and keeps the streak.
            </p>
          )}

          <div className="dd-card__actions">
            <a className="btn btn--hero dd-card__watch" href={DD_CENTRAL_URL} target="_blank" rel="noopener noreferrer" onClick={() => !timerRunning && startTimer()}>
              {timerRunning ? 'Reopen videos ↗' : 'Start & open videos ↗'}
            </a>
            {timerRunning && timer ? (
              <div className="dd-card__timer" data-numeric>
                {clock(now - timer.startedAt)}
              </div>
            ) : (
              <button className="btn btn--text" onClick={startTimer}>
                Timer only
              </button>
            )}
            <button className="btn btn--ghost" onClick={() => onLog('completed', slot, slot.workoutId)}>
              {timerRunning ? 'Finish & log' : 'Log it'}
            </button>
          </div>
          <p className="dd-card__hint">
            Videos open on your DIG DEEPER Central page (or the{' '}
            <a href={BODI_URL} target="_blank" rel="noopener noreferrer">
              BODi app
            </a>
            ). Come back here to log.
          </p>

          <div className="dd-card__alts">
            {shorts.length > 0 && (
              <button className="btn btn--text" onClick={() => setShowShort((v) => !v)}>
                Short on time? No Excuses (under 25 min)
              </button>
            )}
            {isCardioDay && stairs && (
              <button className="btn btn--text" onClick={() => onFinisher(stairs, slot)}>
                Do the stair climber instead
              </button>
            )}
            <button className="btn btn--text" onClick={() => setConfirmSkip(true)}>
              Skip
            </button>
          </div>
          {showShort && (
            <div className="dd-card__shorts">
              <p className="dd-card__note">BODi's rule: pick the No Excuses workout that matches what you're missing.</p>
              {shorts.map((s) => (
                <button key={s.id} className="hub-card" onClick={() => onLog('substitute', slot, s.id)}>
                  <span className="hub-card__head">
                    <span className="hub-card__title">{s.title}</span>
                    <span className="hub-card__meta">{s.minutes} min ›</span>
                  </span>
                  <span className="hub-card__body">Log it as today's workout once you've done it.</span>
                </button>
              ))}
            </div>
          )}
          {confirmSkip && (
            <div className="dd-card__confirm">
              <p className="dd-card__note">Skip {workout.title}? The plan moves on to the next workout. You can delete the log later in Progress.</p>
              <div className="checkin-card__row">
                <button className="btn btn--ghost" onClick={() => onSkip(slot)}>
                  Skip it
                </button>
                <button className="btn btn--text" onClick={() => setConfirmSkip(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {!slot && plan.loggedToday.length > 0 && (
        <section className="dd-card">
          <div className="dd-card__eyebrow">Logged today</div>
          {plan.loggedToday.map((l) => (
            <div key={l.id} className="dd-card__logged">
              {l.type === 'rest'
                ? 'Rest day'
                : l.type === 'skipped'
                  ? `Skipped ${DD_BY_ID.get(l.scheduledWorkoutId ?? '')?.title ?? ''}`
                  : `${DD_BY_ID.get(l.performedWorkoutId ?? '')?.title ?? l.notes ?? 'Workout'}${l.type === 'substitute' ? ' (swap)' : ''}`}
              {l.durationMin ? ` · ${l.durationMin} min` : ''}
            </div>
          ))}
          <p className="dd-card__note">Next up tomorrow. Add a finisher below if you haven't yet.</p>
        </section>
      )}

      {!slot && !plan.loggedToday.length && !plan.complete && (
        <section className="dd-card">
          <div className="dd-card__eyebrow">{beforeStart ? `Starts ${day(program.settings.startDate)}` : 'Rest day'}</div>
          <h2 className="dd-card__title">{beforeStart ? 'Not started yet' : 'Recover today'}</h2>
          {plan.next && (
            <p className="dd-card__note">
              Next: {DD_BY_ID.get(plan.next.workoutId)!.title}
              {plan.projection[0] ? ` on ${day(plan.projection[0].date)}` : ''}.
            </p>
          )}
          <div className="checkin-card__row">
            <button className="btn btn--ghost" onClick={() => setTrainAnyway(true)}>
              Train anyway
            </button>
            {!beforeStart && (
              <button className="btn btn--text" onClick={onRestDay}>
                Log rest day
              </button>
            )}
          </div>
        </section>
      )}

      {picks.length > 0 && (slot || plan.loggedToday.some((l) => l.type !== 'rest')) && (
        <section className="dd-finishers">
          <h2 className="dd-finishers__title">After your workout</h2>
          <p className="dd-finishers__why">
            Lift first, then cardio: your lifts get your freshest effort, and the stairs or rope burn well because you're already warm.
          </p>
          {picks.map((p) => {
            const session = p.kind === 'stairs' ? stairSession(p.number, stairBase) : p.kind === 'rope' ? ropeSession(p.number) : saunaSession(p.number);
            return (
              <button key={p.kind} className="hub-card" onClick={() => onFinisher(p)}>
                <span className="hub-card__head">
                  <span className="hub-card__title">{session.title}</span>
                  <span className="hub-card__meta">{Math.round(totalSeconds(session) / 60)} min ›</span>
                </span>
                <span className="hub-card__body">{session.summary}</span>
                {p.note && <span className="hub-card__when">{p.note}</span>}
              </button>
            );
          })}
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="dd-upnext">
          <h2 className="dd-finishers__title">Up next</h2>
          <ul className="dd-upnext__list">
            {upcoming.map((p) => (
              <li key={p.slot.id} className="dd-upnext__row">
                <span className="dd-upnext__date">{day(p.date)}</span>
                <span>
                  {DD_BY_ID.get(p.slot.workoutId)!.title}
                  {p.slot.optional ? ' · optional' : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
