/**
 * Downshift — the closing ritual. Extended-exhale breathing (parasympathetic-
 * leaning) plus a short stretch cue for what was just trained, then a hard
 * stop. Sessions get a clear edge instead of trailing off into "am I done?"
 */

import { useState } from 'react';
import { BreathSequence, TimedPrompt } from './PhasePrimer';
import { PROTOCOLS } from './BreathPacer';

const COOLDOWN_COPY: Record<string, { title: string; lines: string[] }> = {
  a: { title: 'Cool down · Legs', lines: ['Kneeling hip flexor stretch, both sides.', 'Let the exhale be longer than the inhale.'] },
  b: { title: 'Cool down · Chest & shoulders', lines: ['Doorway chest stretch, both sides.', 'Let the shoulders drop away from the ears.'] },
  c: { title: 'Cool down · Hamstrings', lines: ['Seated or standing hamstring stretch.', 'No bouncing — hold, breathe, ease in.'] },
  d: { title: 'Cool down · Back & lats', lines: ['Child’s pose or a lat stretch on a doorframe.', 'Let the exhale be longer than the inhale.'] },
};

export interface DownshiftPhaseProps {
  dayId: string;
  onComplete: () => void;
}

export function DownshiftPhase({ dayId, onComplete }: DownshiftPhaseProps) {
  const [breathDone, setBreathDone] = useState(false);
  const copy = COOLDOWN_COPY[dayId] ?? COOLDOWN_COPY.a!;

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
