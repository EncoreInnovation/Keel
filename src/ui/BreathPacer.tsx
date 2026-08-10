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

import { useEffect, useRef, useState } from 'react';

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

const RING_MIN = 0.55;
const RING_MAX = 1.0;

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

function targetScale(kind: BreathPhaseKind, previousEnd: number): number {
  if (kind === 'in') return RING_MAX;
  if (kind === 'out') return RING_MIN;
  return previousEnd;
}

export interface BreathPacerProps {
  protocol: BreathProtocol;
  /** Called whenever a new cycle begins (the phase list wraps back to its start). */
  onCycle?: () => void;
}

export function BreathPacer({ protocol, onCycle }: BreathPacerProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const lastScaleRef = useRef(RING_MIN);
  const phaseStartScaleRef = useRef(RING_MIN);

  useEffect(() => {
    setPhaseIndex(0);
    setElapsed(0);
    lastScaleRef.current = RING_MIN;
    phaseStartScaleRef.current = RING_MIN;
  }, [protocol]);

  useEffect(() => {
    const phase = protocol.phases[phaseIndex];
    if (!phase) return;

    phaseStartScaleRef.current = lastScaleRef.current;
    if (phaseIndex === 0) onCycle?.();

    const id = window.setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 0.1;
        if (next >= phase.seconds) {
          lastScaleRef.current = targetScale(phase.kind, phaseStartScaleRef.current);
          setPhaseIndex((i) => (i + 1) % protocol.phases.length);
          return 0;
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIndex, protocol]);

  const phase = protocol.phases[phaseIndex];
  if (!phase) return null;

  const progress = phase.seconds > 0 ? elapsed / phase.seconds : 1;
  const start = phaseStartScaleRef.current;
  const end = targetScale(phase.kind, start);
  const scale = start + (end - start) * progress;

  return (
    <div className="breath-pacer" aria-live="polite">
      <div className="breath-pacer__ring-wrap">
        <div className="breath-pacer__ring" style={{ transform: `scale(${scale})` }} />
      </div>
      <div className="breath-pacer__label">{phase.label}</div>
    </div>
  );
}
