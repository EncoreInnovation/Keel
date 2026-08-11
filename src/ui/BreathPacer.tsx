/**
 * Animated breath pacer.
 *
 * Drives a ring through an ordered list of phases from a declarative
 * protocol. Reused in five places: Arrive, Downshift, the rest timer between
 * sets, and the Reset/Realign pillar sessions — so rest becomes breath
 * practice instead of dead phone-scrolling time, without five separate
 * implementations to keep in sync.
 *
 * Phases are a flat list rather than a fixed inhale/hold/exhale/hold struct
 * so a protocol like the physiological sigh — two inhales, then one long
 * exhale — can be expressed directly instead of forced into a shape that
 * loses the thing that makes it work.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildBreathKeyframes,
  computeBreathFrame,
  cycleDurationSeconds,
  cycleNumber,
  type BreathFrame,
} from './breathTiming';

export type BreathPhaseKind = 'in' | 'out' | 'holdExpanded' | 'holdContracted';

export interface BreathPhase {
  kind: BreathPhaseKind;
  seconds: number;
  label: string;
}

export interface BreathProtocol {
  name: string;
  phases: BreathPhase[];
}

export const PROTOCOLS = {
  /** Coherent breathing — the Arrive default. Even, unhurried, easy to sync to. */
  coherent: {
    name: 'Coherent',
    phases: [
      { kind: 'in', seconds: 5.5, label: 'Breathe in' },
      { kind: 'out', seconds: 5.5, label: 'Breathe out' },
    ],
  },
  /** Extended exhale — parasympathetic-leaning, the Downshift default. */
  extendedExhale: {
    name: 'Extended exhale',
    phases: [
      { kind: 'in', seconds: 4, label: 'Breathe in' },
      { kind: 'out', seconds: 8, label: 'Breathe out, slowly' },
    ],
  },
  /** Box breathing — used in the standalone Reset micro-session. */
  box: {
    name: 'Box',
    phases: [
      { kind: 'in', seconds: 4, label: 'Breathe in' },
      { kind: 'holdExpanded', seconds: 4, label: 'Hold' },
      { kind: 'out', seconds: 4, label: 'Breathe out' },
      { kind: 'holdContracted', seconds: 4, label: 'Hold' },
    ],
  },
  /**
   * The physiological sigh: a full inhale through the nose, a short second
   * "sip" to top the lungs off, then one long slow exhale. The double-inhale
   * is the entire mechanism — it's what most efficiently offloads CO2 and
   * drops activation fast — so it's modelled as two real phases, not
   * approximated away.
   */
  physiologicalSigh: {
    name: 'Physiological sigh',
    phases: [
      { kind: 'in', seconds: 2, label: 'Breathe in' },
      { kind: 'in', seconds: 1, label: 'And a second sip' },
      { kind: 'out', seconds: 7, label: 'Let it all go' },
    ],
  },
  /** 4-7-8 — a longer breath-hold protocol used in the Reset library. */
  fourSevenEight: {
    name: '4-7-8',
    phases: [
      { kind: 'in', seconds: 4, label: 'Breathe in' },
      { kind: 'holdExpanded', seconds: 7, label: 'Hold' },
      { kind: 'out', seconds: 8, label: 'Breathe out, slowly' },
    ],
  },
} as const satisfies Record<string, BreathProtocol>;

export interface BreathPacerProps {
  protocol: BreathProtocol;
  /** Called whenever a new cycle begins (the phase list wraps back to its start). */
  onCycle?: () => void;
}

/**
 * Driven by `requestAnimationFrame` sampling `performance.now()`, not a
 * `setInterval` accumulator — every frame recomputes ring position directly
 * from elapsed wall-clock time via the pure math in `breathTiming.ts`, so
 * there's nothing to drift and nothing for a jittery timer to desynchronize
 * from. See that module's header for the full account of what was wrong
 * with the previous version.
 */
export function BreathPacer({ protocol, onCycle }: BreathPacerProps) {
  const keyframes = useMemo(() => buildBreathKeyframes(protocol), [protocol]);
  const totalSeconds = useMemo(() => cycleDurationSeconds(protocol), [protocol]);

  const [frame, setFrame] = useState<BreathFrame>(() => computeBreathFrame(keyframes, totalSeconds, 0));
  const startRef = useRef(0);
  const lastCycleRef = useRef(-1);
  const rafRef = useRef<number>();

  useEffect(() => {
    startRef.current = performance.now();
    lastCycleRef.current = -1;

    const tick = (now: number) => {
      const elapsedSeconds = (now - startRef.current) / 1000;
      const cycle = cycleNumber(totalSeconds, elapsedSeconds);
      if (cycle !== lastCycleRef.current) {
        lastCycleRef.current = cycle;
        onCycle?.();
      }
      setFrame(computeBreathFrame(keyframes, totalSeconds, elapsedSeconds));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyframes, totalSeconds]);

  return (
    <div className="breath-pacer" aria-live="polite">
      <div className="breath-pacer__ring-wrap">
        <div className="breath-pacer__ring" style={{ transform: `scale(${frame.scale})` }} />
        <div className="breath-pacer__count" data-numeric>
          {frame.secondsRemaining}
        </div>
      </div>
      <div className="breath-pacer__label">{frame.phase.label}</div>
    </div>
  );
}
