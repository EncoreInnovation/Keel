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

const PRIMER_COPY: Record<string, { title: string; lines: string[] }> = {
  push: {
    title: 'Push primer',
    lines: [
      'Arm circles, both directions.',
      'A few wall slides, elbows and wrists on the wall.',
      "Open the chest on the exhale — don't force the reach.",
    ],
  },
  pull: {
    title: 'Pull primer',
    lines: [
      'Band pull-aparts, slow.',
      'Cat-cow through the thoracic spine.',
      'Shoulder blades reaching forward on the inhale, together on the exhale.',
    ],
  },
  legs: {
    title: 'Legs primer',
    lines: [
      'A few bodyweight sit-to-stands, unhurried.',
      'Ankle rocks, both sides.',
      'Exhale fully at the bottom of each rep — ribs down.',
    ],
  },
  upper: {
    title: 'Upper primer',
    lines: [
      'Arm circles, both directions, then band pull-aparts.',
      'A few wall slides, elbows and wrists on the wall.',
      'Open on the exhale, front and back — no forcing the reach.',
    ],
  },
  lower: {
    title: 'Lower primer',
    lines: [
      'Hip hinge pattern with a dowel or broomstick, slow.',
      'A few glute bridges, exhale at the top.',
      'Hamstrings loose, not locked out.',
    ],
  },
};

export interface ArrivePhaseProps {
  dayId: string;
  onComplete: () => void;
}

export function ArrivePhase({ dayId, onComplete }: ArrivePhaseProps) {
  const [breathDone, setBreathDone] = useState(false);
  const copy = PRIMER_COPY[dayId] ?? PRIMER_COPY.push!;

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
