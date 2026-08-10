/**
 * Animated breath pacer.
 *
 * Drives a ring through inhale / hold / exhale / hold from a declarative
 * protocol, in seconds per phase. Reused in three places: the Arrive
 * repositioning sequence, the Downshift cooldown, and the rest timer between
 * sets — so rest becomes breath practice instead of dead phone-scrolling
 * time, without three separate implementations to keep in sync.
 */

import { useEffect, useRef, useState } from 'react';

export interface BreathProtocol {
  name: string;
  /** Seconds for inhale / hold / exhale / hold. A phase of 0 is skipped. */
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
}

export const PROTOCOLS = {
  /** Coherent breathing — the Arrive default. Even, unhurried, easy to sync to. */
  coherent: { name: 'Coherent', inhale: 5.5, holdIn: 0, exhale: 5.5, holdOut: 0 },
  /** Extended exhale — parasympathetic-leaning, the Downshift default. */
  extendedExhale: { name: 'Extended exhale', inhale: 4, holdIn: 0, exhale: 8, holdOut: 0 },
  /** Box breathing — used in the standalone Reset micro-session. */
  box: { name: 'Box', inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
} as const satisfies Record<string, BreathProtocol>;

type Phase = 'inhale' | 'holdIn' | 'exhale' | 'holdOut';

const PHASE_LABEL: Record<Phase, string> = {
  inhale: 'Breathe in',
  holdIn: 'Hold',
  exhale: 'Breathe out',
  holdOut: 'Hold',
};

function phaseOrder(protocol: BreathProtocol): { phase: Phase; seconds: number }[] {
  return (
    [
      { phase: 'inhale', seconds: protocol.inhale },
      { phase: 'holdIn', seconds: protocol.holdIn },
      { phase: 'exhale', seconds: protocol.exhale },
      { phase: 'holdOut', seconds: protocol.holdOut },
    ] as const
  ).filter((p) => p.seconds > 0);
}

export interface BreathPacerProps {
  protocol: BreathProtocol;
  /** Called at the start of every inhale — used to count completed breaths. */
  onCycle?: () => void;
}

export function BreathPacer({ protocol, onCycle }: BreathPacerProps) {
  const sequence = useRef(phaseOrder(protocol));
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    sequence.current = phaseOrder(protocol);
    setStepIndex(0);
    setElapsed(0);
  }, [protocol]);

  useEffect(() => {
    const step = sequence.current[stepIndex];
    if (!step) return;

    if (step.phase === 'inhale' && elapsed === 0) onCycle?.();

    const id = window.setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 0.1;
        if (next >= step.seconds) {
          setStepIndex((i) => (i + 1) % sequence.current.length);
          return 0;
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const step = sequence.current[stepIndex];
  if (!step) return null;

  const progress = step.seconds > 0 ? elapsed / step.seconds : 0;
  // Ring scales 0.55→1.0 on inhale, holds, then back down on exhale — the
  // visual is the instruction, the label is just backup for anyone glancing
  // instead of watching closely.
  const scale =
    step.phase === 'inhale'
      ? 0.55 + 0.45 * progress
      : step.phase === 'exhale'
        ? 1.0 - 0.45 * progress
        : step.phase === 'holdIn'
          ? 1.0
          : 0.55;

  return (
    <div className="breath-pacer" aria-live="polite">
      <div className="breath-pacer__ring-wrap">
        <div className="breath-pacer__ring" style={{ transform: `scale(${scale})` }} />
      </div>
      <div className="breath-pacer__label">{PHASE_LABEL[step.phase]}</div>
    </div>
  );
}
