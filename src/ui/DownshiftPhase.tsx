/**
 * Downshift — the closing ritual. Extended-exhale breathing (parasympathetic-
 * leaning) plus a short stretch cue for what was just trained, then a hard
 * stop. Sessions get a clear edge instead of trailing off into "am I done?"
 */

import { useState } from 'react';
import { BreathSequence, TimedPrompt } from './PhasePrimer';
import { PROTOCOLS } from './BreathPacer';
import { cooldownFor } from './phaseCopy';
import { REFLECTION_PROMPT } from '../mind/cues';

export interface DownshiftPhaseProps {
  dayId: string;
  /** Called with the one-line reflection (empty if skipped). */
  onComplete: (reflection: string) => void;
}

type Step = 'breath' | 'stretch' | 'reflect';

export function DownshiftPhase({ dayId, onComplete }: DownshiftPhaseProps) {
  const [step, setStep] = useState<Step>('breath');
  const [note, setNote] = useState('');
  const copy = cooldownFor(dayId);

  return (
    <div className="phase-screen">
      <div className="phase-screen__eyebrow">Downshift</div>
      {step === 'breath' && (
        <BreathSequence protocol={PROTOCOLS.extendedExhale} cycles={3} onComplete={() => setStep('stretch')} />
      )}
      {step === 'stretch' && (
        <TimedPrompt seconds={60} title={copy.title} lines={copy.lines} onComplete={() => setStep('reflect')} />
      )}
      {step === 'reflect' && (
        <div className="downshift-reflect">
          <div className="phase-primer__title">{REFLECTION_PROMPT}</div>
          <textarea
            className="downshift-reflect__input"
            rows={2}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Session reflection"
          />
          <button className="btn btn--hero" onClick={() => onComplete(note.trim())}>
            Done
          </button>
          <button className="btn btn--text" onClick={() => onComplete('')}>
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
