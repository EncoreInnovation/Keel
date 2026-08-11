/**
 * Pure timing math for the breath pacer, kept separate from the React
 * component so it can be tested with plain numbers — no timers, no DOM, no
 * `requestAnimationFrame` polyfill required.
 *
 * The old pacer drove the ring off a 100ms `setInterval` that accumulated
 * `elapsed += 0.1` on each tick, paired with a CSS transition exactly as
 * long as the tick interval. Three things compounded into visible jumpiness:
 * a 10Hz update rate against a 60Hz display, wall-clock drift from assuming
 * the interval fires exactly on time, and the CSS transition re-triggering
 * out of phase with the JS-driven scale whenever the browser's timer jittered
 * (routine on mobile or a backgrounded tab). This module fixes the root
 * cause — position computed directly from elapsed wall-clock time via
 * `performance.now()`, sampled every animation frame — so there's no
 * accumulator to drift and no second animation system to fight.
 */

import type { BreathPhase, BreathProtocol } from './BreathPacer';

export const RING_MIN = 0.55;
export const RING_MAX = 1.0;

function phaseEndScale(kind: BreathPhase['kind'], startScale: number): number {
  if (kind === 'in') return RING_MAX;
  if (kind === 'out') return RING_MIN;
  return startScale; // holds sustain whatever scale they were entered at
}

export interface BreathKeyframe {
  phase: BreathPhase;
  startScale: number;
  endScale: number;
  /** Seconds into one full cycle at which this phase begins. */
  cycleStartSeconds: number;
}

/**
 * Precompute the whole cycle's scale keyframes up front. Because 'in'/'out'
 * always target a fixed scale and hold phases always sustain whatever they
 * were entered at, the full sequence is deterministic from the protocol
 * alone — no mutable ref tracking "last scale" needed at render time.
 */
export function buildBreathKeyframes(protocol: BreathProtocol): BreathKeyframe[] {
  let scale = RING_MIN;
  let cursor = 0;
  return protocol.phases.map((phase) => {
    const startScale = scale;
    const endScale = phaseEndScale(phase.kind, startScale);
    const keyframe: BreathKeyframe = { phase, startScale, endScale, cycleStartSeconds: cursor };
    scale = endScale;
    cursor += phase.seconds;
    return keyframe;
  });
}

export function cycleDurationSeconds(protocol: BreathProtocol): number {
  return protocol.phases.reduce((sum, p) => sum + p.seconds, 0);
}

/** Smooth in and out of each phase rather than a constant-velocity linear move. */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * Math.min(1, Math.max(0, t))) - 1) / 2;
}

export interface BreathFrame {
  phaseIndex: number;
  phase: BreathPhase;
  scale: number;
  /** Whole seconds left in the current phase, for the on-screen countdown. */
  secondsRemaining: number;
}

const EMPTY_PHASE: BreathPhase = { kind: 'in', seconds: 0, label: '' };

/**
 * The ring's state at an arbitrary point in wall-clock time. `elapsedSeconds`
 * is unbounded — this wraps it into the cycle itself, so the caller never
 * needs to reset a timer or track "which cycle" by hand.
 */
export function computeBreathFrame(
  keyframes: BreathKeyframe[],
  totalCycleSeconds: number,
  elapsedSeconds: number,
): BreathFrame {
  if (keyframes.length === 0 || totalCycleSeconds <= 0) {
    return { phaseIndex: 0, phase: EMPTY_PHASE, scale: RING_MIN, secondsRemaining: 0 };
  }

  const wrapped = elapsedSeconds % totalCycleSeconds;
  let index = keyframes.length - 1;
  for (let i = 0; i < keyframes.length; i += 1) {
    const kf = keyframes[i]!;
    if (wrapped < kf.cycleStartSeconds + kf.phase.seconds) {
      index = i;
      break;
    }
  }

  const kf = keyframes[index]!;
  const elapsedInPhase = wrapped - kf.cycleStartSeconds;
  const progress = kf.phase.seconds > 0 ? Math.min(1, elapsedInPhase / kf.phase.seconds) : 1;
  const eased = easeInOutSine(progress);
  const scale = kf.startScale + (kf.endScale - kf.startScale) * eased;
  const secondsRemaining = Math.max(0, Math.ceil(kf.phase.seconds - elapsedInPhase));

  return { phaseIndex: index, phase: kf.phase, scale, secondsRemaining };
}

/** Which full cycle `elapsedSeconds` falls in — 0 for the first, 1 for the second, etc. */
export function cycleNumber(totalCycleSeconds: number, elapsedSeconds: number): number {
  if (totalCycleSeconds <= 0) return 0;
  return Math.floor(elapsedSeconds / totalCycleSeconds);
}
