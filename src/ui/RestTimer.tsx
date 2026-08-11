/**
 * Auto-starting rest timer.
 *
 * Nobody taps a button to begin resting — DONE on a set starts this
 * immediately. Runs with the phone in a pocket: audio and haptic cues carry
 * the state, not the screen. The breath pacer fills the dead time so rest
 * becomes practice instead of idle scrolling.
 */

import { useEffect, useRef, useState } from 'react';
import { BreathPacer, PROTOCOLS } from './BreathPacer';
import { playRestCountdownTick, playRestEnd, playRestStart } from './audio';
import { haptics } from './haptics';

export interface RestTimerProps {
  seconds: number;
  onComplete: () => void;
}

const EXTEND_SECONDS = 30;
const SHORTEN_SECONDS = 30;

export function RestTimer({ seconds, onComplete }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const tickedRef = useRef(new Set<number>());
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      playRestStart();
      haptics.restStart();
    }
  }, []);

  useEffect(() => {
    if (remaining <= 0) {
      playRestEnd();
      haptics.restEnd();
      onComplete();
      return;
    }

    if (remaining <= 3 && !tickedRef.current.has(remaining)) {
      tickedRef.current.add(remaining);
      playRestCountdownTick();
      haptics.restTick();
    }

    const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining, onComplete]);

  const mm = Math.floor(Math.max(0, remaining) / 60);
  const ss = Math.max(0, remaining) % 60;

  return (
    <div className="rest-timer">
      <div className="rest-timer__eyebrow">Rest</div>
      <div className="rest-timer__clock" data-numeric>
        {mm}:{ss.toString().padStart(2, '0')}
      </div>
      <BreathPacer protocol={PROTOCOLS.coherent} />
      <div className="rest-timer__actions">
        <button
          className="btn btn--ghost"
          onClick={() => setRemaining((r) => Math.max(0, r - SHORTEN_SECONDS))}
        >
          −30s
        </button>
        <button className="btn btn--ghost" onClick={() => setRemaining((r) => r + EXTEND_SECONDS)}>
          +30s
        </button>
        <button className="btn btn--ghost" onClick={() => setRemaining(0)}>
          Skip
        </button>
      </div>
    </div>
  );
}
