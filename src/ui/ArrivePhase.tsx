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
import { CUE_WORDS, DEFAULT_IF_THEN } from '../mind/cues';

export interface ArrivePhaseProps {
  dayId: string;
  /** Called with the cue word chosen for this session. */
  onComplete: (cueWord: string) => void;
}

type Step = 'breath' | 'primer' | 'intent';

export function ArrivePhase({ dayId, onComplete }: ArrivePhaseProps) {
  const [step, setStep] = useState<Step>('breath');
  const [copy] = useState(() => primerFor(dayId, new Date().getHours()));

  return (
    <div className="phase-screen">
      <div className="phase-screen__eyebrow">Arrive</div>
      {step === 'breath' && (
        <BreathSequence protocol={PROTOCOLS.coherent} cycles={3} onComplete={() => setStep('primer')} />
      )}
      {step === 'primer' && (
        <TimedPrompt seconds={45} title={copy.title} lines={copy.lines} onComplete={() => setStep('intent')} />
      )}
      {step === 'intent' && (
        <div className="arrive-intent">
          <div className="phase-primer__title">Pick today’s cue word</div>
          <p className="arrive-intent__plan">{DEFAULT_IF_THEN}</p>
          <div className="settings-options arrive-intent__cues">
            {CUE_WORDS.map((cue) => (
              <button key={cue} className="chip" onClick={() => onComplete(cue)}>
                {cue}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
