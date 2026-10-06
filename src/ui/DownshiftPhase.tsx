/**
 * Downshift — the closing ritual. Extended-exhale breathing (parasympathetic-
 * leaning) plus a short stretch cue for what was just trained, then a hard
 * stop. Sessions get a clear edge instead of trailing off into "am I done?"
 */

import { useState } from 'react';
import { BreathSequence, TimedPrompt } from './PhasePrimer';
import { PROTOCOLS } from './BreathPacer';
import { cooldownFor } from './phaseCopy';

export interface DownshiftPhaseProps {
  dayId: string;
  onComplete: () => void;
}

export function DownshiftPhase({ dayId, onComplete }: DownshiftPhaseProps) {
  const [breathDone, setBreathDone] = useState(false);
  const copy = cooldownFor(dayId);

  return (
    <div className="phase-screen">
      <div className="phase-screen__eyebrow">Downshift</div>
      {!breathDone ? (
        <BreathSequence
          protocol={PROTOCOLS.extendedExhale}
          cycles={3}
          onComplete={() => setBreathDone(true)}
        />
      ) : (
        <TimedPrompt seconds={60} title={copy.title} lines={copy.lines} onComplete={onComplete} />
      )}
    </div>
  );
}
