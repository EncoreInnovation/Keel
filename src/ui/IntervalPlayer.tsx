/**
 * Guided timer for the finishers — stair climber, jump rope, sauna.
 *
 * Time comes from the clock, not from counting ticks, so locking the phone
 * or switching apps mid-interval doesn't stretch the session: coming back
 * shows exactly where you'd be. Beeps mark every change (a higher tone when
 * work starts, a lower one for rest) with a three-second countdown before it,
 * and the screen stays awake for the whole thing.
 *
 * At the end a progressive program asks how it felt — that rating is what
 * moves you to the next session or repeats this one. Ending early counts as
 * "too hard", so an unfinished session is done again next time.
 */

import { useEffect, useRef, useState } from 'react';
import type { FinisherRating } from '../engine/types';
import { totalSeconds, RATING_LABEL, type FinisherResult, type FinisherSession } from '../programs/finishers';
import { playRestCountdownTick, playRestEnd, playRestStart, primeAudio } from './audio';
import { acquireWakeLock, type WakeLockHandle } from './wakeLock';

export interface IntervalPlayerProps {
  session: FinisherSession;
  /** Extra lines shown before starting (safety notes, technique cues). */
  notes?: string[];
  /** Stair session 1: ask which level felt 6/10, starting from this one. */
  askBaseLevel?: number;
  onFinish: (result: FinisherResult) => void;
  onCancel: () => void;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

export function IntervalPlayer({ session, notes = [], askBaseLevel, onFinish, onCancel }: IntervalPlayerProps) {
  const total = totalSeconds(session);
  const [startedAt, setStartedAt] = useState<number | undefined>();
  const [pausedAt, setPausedAt] = useState<number | undefined>();
  const [pausedMs, setPausedMs] = useState(0);
  const [skippedSec, setSkippedSec] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [ended, setEnded] = useState<{ elapsedSec: number; completed: boolean } | undefined>();
  const [baseLevel, setBaseLevel] = useState(askBaseLevel);
  const lastSecond = useRef<number | undefined>();
  const lastIndex = useRef<number>(-1);
  const wake = useRef<WakeLockHandle | undefined>();

  const running = startedAt !== undefined && !ended;
  const elapsedSec = startedAt === undefined ? 0 : ((pausedAt ?? now) - startedAt - pausedMs) / 1000 + skippedSec;

  // Which segment we're in, and how long is left of it.
  let index = 0;
  let segEnd = 0;
  for (let acc = 0, i = 0; i < session.segments.length; i += 1) {
    acc += session.segments[i]!.seconds;
    if (elapsedSec < acc) {
      index = i;
      segEnd = acc;
      break;
    }
    index = i;
    segEnd = acc;
  }
  const seg = session.segments[index]!;
  const left = Math.max(0, segEnd - elapsedSec);
  const next = session.segments[index + 1];

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    return () => void wake.current?.release();
  }, []);

  // Cues and the finish.
  useEffect(() => {
    if (!running || pausedAt !== undefined) return;
    if (elapsedSec >= total) {
      playRestEnd();
      void wake.current?.release();
      setEnded({ elapsedSec: total, completed: true });
      return;
    }
    if (lastIndex.current !== index) {
      if (lastIndex.current !== -1) (seg.rest ? playRestStart : playRestEnd)();
      lastIndex.current = index;
    }
    const whole = Math.ceil(left);
    if (whole <= 3 && whole >= 1 && lastSecond.current !== whole) playRestCountdownTick();
    lastSecond.current = whole;
  }, [running, pausedAt, elapsedSec, total, index, left, seg.rest]);

  const start = async () => {
    primeAudio();
    wake.current = await acquireWakeLock();
    const t = Date.now();
    setNow(t);
    setStartedAt(t);
  };

  const togglePause = () => {
    if (pausedAt === undefined) {
      setPausedAt(Date.now());
    } else {
      setPausedMs((ms) => ms + (Date.now() - pausedAt));
      setPausedAt(undefined);
      setNow(Date.now());
    }
  };

  const skip = () => setSkippedSec((s) => s + left);

  const endEarly = () => {
    void wake.current?.release();
    setEnded({ elapsedSec: Math.round(elapsedSec), completed: false });
  };

  const rated = session.kind !== 'sauna';

  if (startedAt === undefined) {
    return (
      <div className="phase-screen interval">
        <div className="phase-screen__eyebrow">{session.title}</div>
        <h1 className="interval__title">{session.summary}</h1>
        <p className="placeholder__body">About {Math.round(total / 60)} min total.</p>
        <ol className="interval__plan">
          {session.segments.map((s, i) => (
            <li key={i} className={s.rest ? 'interval__plan-row interval__plan-row--rest' : 'interval__plan-row'}>
              <span>{s.label}</span>
              <span data-numeric>
                {s.level !== undefined && `Level ${s.level} · `}
                {clock(s.seconds)}
              </span>
            </li>
          ))}
        </ol>
        {notes.length > 0 && (
          <ul className="interval__notes">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <button className="btn btn--hero" onClick={() => void start()}>
          Start
        </button>
        <button className="btn btn--text" onClick={onCancel}>
          Back
        </button>
      </div>
    );
  }

  if (ended) {
    const finish = (rating?: FinisherRating) =>
      onFinish({ ...ended, rating: ended.completed ? rating : rated ? 'hard' : undefined, baseLevel: ended.completed ? baseLevel : undefined });
    return (
      <div className="phase-screen interval">
        <div className="phase-screen__eyebrow">{session.title}</div>
        <h1 className="interval__title">{ended.completed ? 'Done' : `Stopped at ${clock(ended.elapsedSec)}`}</h1>
        {askBaseLevel !== undefined && ended.completed && (
          <label className="weigh-in__field interval__base">
            <span className="weigh-in__label">Level where a steady pace felt 6/10</span>
            <select className="settings-input" value={baseLevel} onChange={(e) => setBaseLevel(Number(e.target.value))}>
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Level {n}
                </option>
              ))}
            </select>
          </label>
        )}
        {rated && ended.completed ? (
          <>
            <p className="placeholder__body">How did that feel? This decides the next session.</p>
            <div className="interval__ratings">
              {(['easy', 'right', 'hard'] as FinisherRating[]).map((r) => (
                <button key={r} className="btn btn--ghost" onClick={() => finish(r)}>
                  {RATING_LABEL[r]}
                </button>
              ))}
            </div>
            <p className="placeholder__body interval__hint">Too easy or Right: next session. Too hard: this one again.</p>
          </>
        ) : (
          <>
            {rated && <p className="placeholder__body">Logged as unfinished — you'll do this session again next time.</p>}
            <button className="btn btn--hero" onClick={() => finish()}>
              Save
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`phase-screen interval${seg.rest ? ' interval--rest' : ''}`}>
      <div className="phase-screen__eyebrow">
        {session.title} · {index + 1} of {session.segments.length}
      </div>
      <div className="interval__segment">{seg.label}</div>
      {seg.level !== undefined && (
        <div className="interval__level" data-numeric>
          Level {seg.level}
        </div>
      )}
      <div className="interval__clock" data-numeric aria-live="off">
        {clock(Math.ceil(left))}
      </div>
      <p className="placeholder__body interval__cue">{seg.cue}</p>
      <div className="interval__progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.round(elapsedSec)}>
        <i style={{ width: `${Math.min(100, (elapsedSec / total) * 100)}%` }} />
      </div>
      <p className="interval__next">
        {next ? `Next: ${next.label}${next.level !== undefined ? ` · level ${next.level}` : ''} · ${clock(next.seconds)}` : 'Last one'}
        {' · '}
        {clock(Math.max(0, total - elapsedSec))} left
      </p>
      <div className="interval__controls">
        <button className="btn btn--ghost" onClick={togglePause}>
          {pausedAt === undefined ? 'Pause' : 'Resume'}
        </button>
        <button className="btn btn--ghost" onClick={skip}>
          Skip
        </button>
        <button className="btn btn--text" onClick={endEarly}>
          End
        </button>
      </div>
    </div>
  );
}
