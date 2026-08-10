/**
 * Generic pillar session player.
 *
 * Pre-rating -> steps in order (breath rings via BreathSequence, moves via
 * TimedPrompt) -> post-rating -> one PillarLog entry written on completion.
 * The same step player serves all four sessions — Reset, Realign, Unlock,
 * Ground differ only in their data, never in how they're driven.
 */

import { useState } from 'react';
import { ActivationRating } from './ActivationRating';
import { BreathSequence, TimedPrompt } from './PhasePrimer';
import { appendPillarLog } from '../storage/repository';
import type { PillarSession } from '../pillars/types';

type Phase = 'preRating' | 'steps' | 'postRating';

export interface PillarPlayerProps {
  session: PillarSession;
  onComplete: () => void;
}

export function PillarPlayer({ session, onComplete }: PillarPlayerProps) {
  const [phase, setPhase] = useState<Phase>('preRating');
  const [stepIndex, setStepIndex] = useState(0);
  const [preActivation, setPreActivation] = useState<number | undefined>();
  const [startedAt] = useState(() => Date.now());

  const advanceStep = () => {
    if (stepIndex + 1 >= session.steps.length) {
      setPhase('postRating');
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const finish = async (postActivation: number) => {
    await appendPillarLog({
      id: `pillar-${session.kind}-${startedAt}`,
      kind: session.kind,
      startedAt,
      completedAt: Date.now(),
      preActivation,
      postActivation,
    });
    onComplete();
  };

  if (phase === 'preRating') {
    return (
      <ActivationRating
        prompt="How keyed up do you feel right now?"
        onSelect={(v) => {
          setPreActivation(v);
          setPhase('steps');
        }}
      />
    );
  }

  if (phase === 'postRating') {
    return <ActivationRating prompt="And now?" onSelect={(v) => void finish(v)} />;
  }

  const step = session.steps[stepIndex];
  if (!step) return null;

  return (
    <div className="phase-screen">
      <div className="phase-screen__eyebrow">
        {session.name} · {stepIndex + 1} of {session.steps.length}
      </div>
      {step.type === 'breath' ? (
        <BreathSequence protocol={step.protocol} cycles={step.cycles} onComplete={advanceStep} />
      ) : (
        <TimedPrompt seconds={step.seconds} title={step.title} lines={[step.cue]} onComplete={advanceStep} />
      )}
    </div>
  );
}
