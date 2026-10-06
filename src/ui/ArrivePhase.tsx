/**
 * Arrive — the momentum ritual that opens every session.
 *
 * Three coherent breath cycles (repositioning: a full exhale drops the ribs
 * and lets the pelvis rotate out of anterior tilt), then a 45-second primer
 * targeted at today's movement pattern. Turns "start the session" into a
 * roughly 2-minute commitment instead of a 40-minute one. Was 90 seconds;
 * shortened after feedback that the gap between the breath work and the
 * actual lifting was dragging.
 */

import { useState } from 'react';
import { BreathSequence, TimedPrompt } from './PhasePrimer';
import { PROTOCOLS } from './BreathPacer';
import { primerFor } from './phaseCopy';

export interface ArrivePhaseProps {
  dayId: string;
  onComplete: () => void;
}

export function ArrivePhase({ dayId, onComplete }: ArrivePhaseProps) {
  const [breathDone, setBreathDone] = useState(false);
  const [copy] = useState(() => primerFor(dayId, new Date().getHours()));

  return (
    <div className="phase-screen">
      <div className="phase-screen__eyebrow">Arrive</div>
      {!breathDone ? (
        <BreathSequence protocol={PROTOCOLS.coherent} cycles={3} onComplete={() => setBreathDone(true)} />
      ) : (
        <TimedPrompt seconds={45} title={copy.title} lines={copy.lines} onComplete={onComplete} />
      )}
    </div>
  );
}
